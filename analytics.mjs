import { randomUUID } from 'node:crypto';

const DAY = 86400000;
const ENGAGEMENT_KEYS = ['like_count', 'reply_count', 'retweet_count', 'quote_count'];
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const isReply = post => post.referenced_tweets?.some(ref => ref.type === 'replied_to') === true;
const impressions = post => number(post.public_metrics?.impression_count);
function engagements(post) {
  const values = ENGAGEMENT_KEYS.map(key => number(post.public_metrics?.[key]));
  return values.some(value => value === null) ? null : values.reduce((sum, value) => sum + value, 0);
}
function sumKnown(posts, metric) {
  if (!posts.length) return null;
  const values = posts.map(metric);
  return values.some(value => value === null) ? null : values.reduce((sum, value) => sum + value, 0);
}
function rate(impressionCount, engagementCount) {
  return impressionCount === null || engagementCount === null || impressionCount === 0 ? null : engagementCount / impressionCount * 100;
}
function totals(posts, state, start, end) {
  const views = sumKnown(posts, impressions);
  const baseline = Date.parse(state.sync?.relationshipBaselineAt);
  const netKnown = state.relationshipBaseline && Number.isFinite(baseline) && baseline <= start;
  return {
    impressions: views,
    engagementRate: rate(views, sumKnown(posts, engagements)),
    posts: posts.filter(post => !isReply(post)).length,
    replies: posts.filter(isReply).length,
    netFollowers: netKnown ? (state.events || []).reduce((sum, event) => {
      const time = Date.parse(event.observedAt);
      return time >= start && time < end ? sum + (event.type === 'follow' ? 1 : event.type === 'unfollow' ? -1 : 0) : sum;
    }, 0) : null,
  };
}

/** Current lifetime metrics grouped by publication day, not views earned that day.
 * Windows use UTC dates, including today up to `now`. Missing/partial metrics
 * produce null aggregates. Net followers is unknown before the first baseline.
 */
export function computeAnalytics(state, days = 28, now = Date.now()) {
  if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error('days must be an integer between 1 and 366');
  const time = typeof now === 'number' ? now : Date.parse(now);
  if (!Number.isFinite(time)) throw new Error('Invalid analytics time');
  const today = Math.floor(time / DAY) * DAY;
  const start = today - (days - 1) * DAY;
  const previousStart = start - days * DAY;
  const owned = (state.posts || []).filter(post => !state.account?.id || post.author_id === state.account.id);
  const current = owned.filter(post => { const t = Date.parse(post.created_at); return t >= start && t <= time; });
  const previous = owned.filter(post => { const t = Date.parse(post.created_at); return t >= previousStart && t < start; });
  const daily = Array.from({ length: days }, (_, index) => {
    const day = start + index * DAY;
    const posts = current.filter(post => { const t = Date.parse(post.created_at); return t >= day && t < day + DAY; });
    return { date: new Date(day).toISOString().slice(0, 10), impressions: sumKnown(posts, impressions), posts: posts.filter(post => !isReply(post)).length, replies: posts.filter(isReply).length };
  });
  const topPosts = current.map(post => ({ ...post, impressions: impressions(post), engagements: engagements(post), engagementRate: rate(impressions(post), engagements(post)) }))
    .sort((a, b) => (b.impressions ?? -1) - (a.impressions ?? -1) || (b.engagements ?? -1) - (a.engagements ?? -1)).slice(0, 20);
  const hours = new Map();
  for (const post of current) { const hour = new Date(post.created_at).getUTCHours(); if (!hours.has(hour)) hours.set(hour, []); hours.get(hour).push(post); }
  const bestHours = [...hours].map(([hour, posts]) => {
    const views = sumKnown(posts, impressions);
    return { hour, posts: posts.length, impressions: views, engagementRate: rate(views, sumKnown(posts, engagements)) };
  }).sort((a, b) => (b.engagementRate ?? -1) - (a.engagementRate ?? -1) || a.hour - b.hour);
  const followerIds = new Set(state.followers || []);
  const followingIds = new Set(state.following || []);
  const mutual = [...followingIds].filter(id => followerIds.has(id)).length;
  const baseline = state.relationshipBaseline === true;
  return {
    totals: totals(current, state, start, time + 1), previous: totals(previous, state, previousStart, start), daily, topPosts, bestHours,
    followers: {
      total: baseline ? followerIds.size : number(state.account?.public_metrics?.followers_count),
      following: baseline ? followingIds.size : number(state.account?.public_metrics?.following_count),
      notFollowingBack: baseline ? followingIds.size - mutual : null,
      mutual: baseline ? mutual : null,
    },
    coverage: {
      days, start: new Date(start).toISOString(), end: new Date(time).toISOString(),
      postsTotal: current.length, impressionsKnown: current.filter(post => impressions(post) !== null).length,
      engagementsKnown: current.filter(post => engagements(post) !== null).length,
      relationshipBaseline: baseline, relationshipBaselineAt: state.sync?.relationshipBaselineAt || null,
      pendingFollowerRemovals: Object.keys(state.missingFollowers || {}).length,
      aggregation: 'Current lifetime post metrics grouped by UTC publication date; not daily earned impressions.',
    },
  };
}

function ids(items, label) {
  if (!Array.isArray(items)) throw new Error(`${label} must be a complete array`);
  return [...new Set(items.map(item => {
    const id = typeof item === 'string' ? item : item?.id;
    if (typeof id !== 'string' || !id.trim()) throw new Error(`Invalid ${label} user ID`);
    return id;
  }))];
}

/** Only complete snapshots can enrich users or change relationship history. */
export function applyRelationships(state, snapshot, now = new Date().toISOString()) {
  if (snapshot.complete !== true) return state;
  const followers = ids(snapshot.followers, 'followers');
  const following = ids(snapshot.following, 'following');
  const users = snapshot.users ?? [];
  if (!Array.isArray(users) || users.some(user => !user || typeof user.id !== 'string' || !user.id)) throw new Error('Invalid relationship users');
  const time = Date.parse(now);
  if (!Number.isFinite(time)) throw new Error('Invalid relationship observation time');
  const lastObservation = Date.parse(state.sync?.followersAt);
  // Replaying or applying an older snapshot is not a second observation.
  if (Number.isFinite(lastObservation) && time <= lastObservation) return state;
  const observedAt = new Date(time).toISOString();
  const previous = new Set(state.followers || []);
  const incoming = new Set(followers);
  const missing = {};
  const confirmed = new Set(followers);
  const events = [...(state.events || [])];
  if (state.relationshipBaseline) {
    for (const id of previous) {
      if (incoming.has(id)) continue;
      const count = Number(state.missingFollowers?.[id] || 0) + 1;
      if (count < 2) { missing[id] = count; confirmed.add(id); }
      else events.push({ id: randomUUID(), userId: id, type: 'unfollow', observedAt, read: false });
    }
    for (const id of incoming) if (!previous.has(id)) events.push({ id: randomUUID(), userId: id, type: 'follow', observedAt, read: false });
  }
  const merged = new Map((state.users || []).map(user => [user.id, user]));
  const objectUsers = [...snapshot.followers, ...snapshot.following].filter(user => typeof user === 'object');
  for (const user of [...objectUsers, ...users]) merged.set(user.id, { ...merged.get(user.id), ...user });
  // Preserve existing order while a removal is pending, then append new IDs.
  state.followers = [...previous].filter(id => confirmed.has(id));
  for (const id of followers) if (!previous.has(id)) state.followers.push(id);
  state.following = following;
  state.users = [...merged.values()];
  state.events = events;
  state.missingFollowers = missing;
  state.sync = { ...state.sync, followersAt: observedAt, relationshipBaselineAt: state.sync?.relationshipBaselineAt || observedAt };
  state.relationshipBaseline = true;
  return state;
}
