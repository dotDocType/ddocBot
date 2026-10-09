import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('first-visit help example only stores the flag when nudge() played', async () => {
  for (const name of ['README.md', 'README.en.md', 'README.es.md']) {
    const text = await readFile(new URL(`../${name}`, import.meta.url), 'utf8');
    assert.match(text, /&& bot\.nudge\(\)\) localStorage\.setItem\(/, name);
  }
});
