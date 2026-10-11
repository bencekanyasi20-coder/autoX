import { DatabaseSync } from 'node:sqlite';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeAnalytics } from './analytics.mjs';

const limitSchema = { type: 'integer', minimum: 1, maximum: 200, default: 50 };
const definitions = [
  ['read_summary', 'Read local account analytics. Missing metrics remain null.', { days: { type: 'integer', minimum: 1, maximum: 366, default: 28 } }],
  ['list_posts', 'Read stored own posts, newest first.', { limit: limitSchema }],
  ['list_followers', 'Read stored relationship profiles; complete snapshot required.', { kind: { type: 'string', enum: ['followers', 'following', 'mutual', 'notFollowingBack'], default: 'followers' }, limit: limitSchema }],
  ['list_inbox', 'Read the local reply inbox.', { status: { type: 'string', enum: ['waiting', 'draft', 'replied', 'ignored'] }, limit: limitSchema }],
  ['list_drafts', 'Read draft, scheduled, and failed queue items. Does not send.', { limit: limitSchema }],
];
const pick = (object, keys) => object ? Object.fromEntries(keys.filter(key => object[key] !== undefined).map(key => [key, object[key]])) : null;
const user = value => pick(value, ['id', 'username', 'name', 'description']);
const post = value => value ? { ...pick(value, ['id', 'text', 'created_at', 'author_id', 'conversation_id']), public_metrics: pick(value.public_metrics, ['like_count', 'reply_count', 'retweet_count', 'quote_count', 'impression_count']), referenced_tweets: (value.referenced_tweets || []).map(ref => pick(ref, ['type', 'id'])) } : null;
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

/** Stateless JSON-RPC dispatch. No provider calls, writes, or secret-store access. */
export function handleMcp(message, state) {
  if (!message || typeof message !== 'object' || Array.isArray(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string' || ('id' in message && message.id !== null && !['string', 'number'].includes(typeof message.id))) return rpcError(null, -32600, 'Invalid Request');
  if (!Object.hasOwn(message, 'id')) return null;
  const reply = result => ({ jsonrpc: '2.0', id: message.id, result });
  const params = message.params ?? {};
  if (!params || typeof params !== 'object' || Array.isArray(params)) return rpcError(message.id, -32602, 'Invalid params');
  if (message.method === 'initialize') return reply({ protocolVersion: ['2024-11-05', '2025-03-26'].includes(params.protocolVersion) ? params.protocolVersion : '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'xauto', version: '0.1.0' }, instructions: 'Read-only local X workspace. Metrics and relationship changes reflect saved observations, not complete X history. No external calls or sending tools.' });
  if (message.method === 'ping') return reply({});
  if (message.method === 'tools/list') return reply({ tools: definitions.map(([name, description, properties]) => ({ name, description, inputSchema: { type: 'object', properties, additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } })) });
  if (message.method !== 'tools/call') return rpcError(message.id, -32601, 'Method not found');
  const definition = definitions.find(([name]) => name === params.name);
  const args = params.arguments ?? {};
  if (!definition || !args || typeof args !== 'object' || Array.isArray(args)) return rpcError(message.id, -32602, 'Unknown tool or invalid arguments');
  const schema = definition[2];
  for (const [key, value] of Object.entries(args)) {
    const rule = schema[key];
    if (!rule || (rule.type === 'integer' && (!Number.isInteger(value) || value < rule.minimum || value > rule.maximum)) || (rule.enum && !rule.enum.includes(value))) return rpcError(message.id, -32602, 'Invalid tool arguments');
  }
  const limit = args.limit ?? 50;
  let data;
  if (params.name === 'read_summary') data = { account: user(state.account), demo: !!state.demo, analytics: computeAnalytics(state, args.days ?? 28) };
  else if (params.name === 'list_posts') data = (state.posts || []).filter(value => !state.account?.id || value.author_id === state.account.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, limit).map(post);
  else if (params.name === 'list_followers') {
    if (!state.relationshipBaseline) data = { available: false, reason: 'No complete relationship baseline has been saved.' };
    else {
      const followers = new Set(state.followers || []), following = state.following || [];
      const kind = args.kind ?? 'followers';
      const ids = kind === 'followers' ? [...followers] : kind === 'following' ? following : following.filter(id => followers.has(id) === (kind === 'mutual'));
      const users = new Map((state.users || []).map(value => [value.id, value]));
      data = ids.slice(0, limit).map(id => user(users.get(id) || { id }));
    }
  } else if (params.name === 'list_inbox') data = (state.inbox || []).filter(item => !args.status || item.status === args.status).slice(0, limit).map(item => ({ ...pick(item, ['id', 'status', 'draft']), post: post(item.post), author: user(item.author) }));
  else data = (state.queue || []).filter(item => ['draft', 'scheduled', 'failed'].includes(item.status)).slice(0, limit).map(item => pick(item, ['id', 'kind', 'text', 'targetId', 'username', 'status', 'scheduledAt', 'createdAt']));
  // Analytics topPosts are projected too: never return arbitrary persisted fields.
  if (params.name === 'read_summary') data.analytics.topPosts = data.analytics.topPosts.map(value => ({ ...post(value), ...pick(value, ['impressions', 'engagements', 'engagementRate']) }));
  return reply({ content: [{ type: 'text', text: JSON.stringify(data) }] });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dataDir = process.env.XAUTO_DATA_DIR || join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'Xauto');
  let db;
  try {
    db = new DatabaseSync(join(dataDir, 'workspace.sqlite'), { readOnly: true });
    const read = db.prepare('SELECT state FROM workspace WHERE id = 1');
    const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
    lines.on('line', line => {
      let message, response;
      try { message = JSON.parse(line); } catch { response = rpcError(null, -32700, 'Parse error'); }
      if (!response) {
        try { response = handleMcp(message, JSON.parse(read.get().state)); }
        catch { response = rpcError(message?.id, -32603, 'Local workspace could not be read'); }
      }
      if (response) process.stdout.write(JSON.stringify(response) + '\n');
    });
    lines.on('close', () => db.close());
  } catch {
    db?.close();
    process.stderr.write('Start Xauto once to create a workspace before connecting MCP.\n');
    process.exitCode = 1;
  }
}
