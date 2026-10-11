import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function load() {
  const context = { window: {} };
  vm.runInNewContext(readFileSync(new URL('../public/errors-i18n.js', import.meta.url), 'utf8'), context);
  return context.window.XautoErrors.translate;
}

test('translates server errors and persisted scheduler and recovery errors', () => {
  const translate = load();
  assert.equal(translate('Érvénytelen X-azonosító.', 'en'), 'Invalid X ID.');
  assert.equal(translate('Az időpont több mint 15 perce elmúlt. Ellenőrizd, majd küldd el kézzel.', 'en'), 'The scheduled time passed more than 15 minutes ago. Review it and send manually.');
  assert.equal(translate('A program küldés közben állt le. Ellenőrizd X-en, mielőtt újra küldenél.', 'en'), 'The app stopped while sending. Check X before sending again.');
  assert.equal(translate('A Windows kulcstároló művelete sikertelen.', 'en'), 'The Windows credential store operation failed.');
});

test('translates only known parameterized setting errors', () => {
  const translate = load();
  for (const key of ['language', 'goal', 'syncMinutes', 'dailyWriteLimit', 'style', 'model', 'niche', 'paused', 'xClientId', 'xClientSecret', 'xAccessToken', 'openaiKey']) {
    assert.equal(translate('Érvénytelen beállítás: ' + key, 'en'), 'Invalid setting: ' + key);
  }
  for (const message of ['Érvénytelen beállítás: user content', 'Érvénytelen beállítás: goal\n', 'prefix Érvénytelen beállítás: goal', 'Érvénytelen X-azonosító. suffix', 'X HTTP 429. Try again later.', 'Saját magyar tartalom', '__proto__', 'constructor']) {
    assert.equal(translate(message, 'en'), message);
  }
});

test('preserves Hungarian, unknown languages and non-string values without coercion', () => {
  const translate = load();
  const message = 'Érvénytelen X-azonosító.';
  for (const language of ['hu', 'fr', undefined, null]) assert.equal(translate(message, language), message);
  for (const value of [null, undefined, 42, {}, new Error(message)]) assert.equal(translate(value, 'en'), value);
});
