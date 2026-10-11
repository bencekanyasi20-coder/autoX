// Test runs must never consume X/OpenAI credits. Provider calls use injected fixtures.
const localFetch = globalThis.fetch;
globalThis.fetch = (input, ...args) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)) {
    return Promise.reject(new Error('External network disabled during tests. Use an injected provider fixture.'));
  }
  return localFetch(input, ...args);
};
