import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('cabeçalho oferece atalho acessível para o repositório no GitHub', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /class="github-link"/);
  assert.match(html, /href="https:\/\/github\.com\/dotDocType\/ddocBot"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /aria-label="Abrir repositório ddocBot no GitHub"/);
  assert.match(html, /<svg[^>]+aria-hidden="true"/);
});
