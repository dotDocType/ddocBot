import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeProgress, normalizeScript } from '../src/training/schema.js';

function minimalScript(overrides = {}) {
  return {
    id: 'intro',
    version: 1,
    steps: [
      { id: 'welcome', text: 'Olá', advance: { type: 'manual' } }
    ],
    ...overrides
  };
}

test('normaliza o roteiro sem compartilhar referências com a entrada', () => {
  const input = {
    id: 'intro',
    version: 1,
    title: 'Introdução',
    steps: [
      {
        id: 'welcome',
        route: 'home',
        target: { ref: 'welcome-button' },
        text: 'Olá',
        audio: { sound: 'beep' },
        advance: { type: 'change', condition: { kind: 'equals', value: 'empresa' } }
      }
    ]
  };

  const result = normalizeScript(input);

  input.title = 'Alterado';
  input.steps[0].text = 'Alterado';
  input.steps[0].target.ref = 'other';
  input.steps[0].audio.sound = 'error';
  input.steps[0].advance.condition.value = 'pessoa';

  assert.deepEqual(result, {
    id: 'intro',
    version: 1,
    title: 'Introdução',
    steps: [
      {
        id: 'welcome',
        route: 'home',
        navigation: 'user',
        target: { ref: 'welcome-button' },
        text: 'Olá',
        laser: false,
        audio: { sound: 'beep' },
        timeout: 15000,
        advance: { type: 'change', condition: { kind: 'equals', value: 'empresa' } }
      }
    ]
  });
  assert.notStrictEqual(result, input);
  assert.notStrictEqual(result.steps, input.steps);
  assert.notStrictEqual(result.steps[0], input.steps[0]);
  assert.notStrictEqual(result.steps[0].target, input.steps[0].target);
  assert.notStrictEqual(result.steps[0].audio, input.steps[0].audio);
  assert.notStrictEqual(result.steps[0].advance, input.steps[0].advance);
  assert.notStrictEqual(result.steps[0].advance.condition, input.steps[0].advance.condition);
});

test('normaliza todas as uniões válidas do roteiro', () => {
  const result = normalizeScript({
    id: 'unions',
    version: 2,
    steps: [
      { id: 'manual', text: 'Continue', advance: { type: 'manual' } },
      { id: 'click', target: '#save', text: 'Clique', laser: true,
        advance: { type: 'click' } },
      { id: 'any-change', target: { ref: 'field' }, text: 'Mude',
        advance: { type: 'change' } },
      { id: 'nonempty', target: 'input', text: 'Preencha',
        advance: { type: 'change', condition: { kind: 'nonempty' } } },
      { id: 'checked', target: 'input[type=checkbox]', text: 'Marque',
        advance: { type: 'change', condition: { kind: 'checked', value: true } } },
      { id: 'signal', target: { x: 12.5, y: -3 }, text: 'Salve',
        audio: { url: '/save.mp3' }, timeout: 1, advance: { type: 'signal', name: 'saved' } },
      { id: 'automatic', route: 'done', navigation: 'automatic', text: 'Fim',
        audio: { sound: 'success' }, advance: { type: 'manual' } }
    ]
  });

  assert.equal(result.steps[0].navigation, 'user');
  assert.equal(result.steps[0].laser, false);
  assert.equal(result.steps[0].timeout, 15000);
  assert.deepEqual(result.steps[5].target, { x: 12.5, y: -3 });
  assert.deepEqual(result.steps[5].advance, { type: 'signal', name: 'saved' });
  assert.equal(result.steps[6].navigation, 'automatic');
});

const invalidScripts = [
  ['id do roteiro vazio', minimalScript({ id: '' }), 'script.id'],
  ['id de passo vazio', minimalScript({ steps: [
    { id: '', text: 'Olá', advance: { type: 'manual' } }
  ] }), 'script.steps[0].id'],
  ['ids de passo duplicados', minimalScript({ steps: [
    { id: 'same', text: 'Um', advance: { type: 'manual' } },
    { id: 'same', text: 'Dois', advance: { type: 'manual' } }
  ] }), 'script.steps[1].id'],
  ['versão fracionária', minimalScript({ version: 1.5 }), 'script.version'],
  ['versão zero', minimalScript({ version: 0 }), 'script.version'],
  ['lista vazia', minimalScript({ steps: [] }), 'script.steps'],
  ['texto ausente', minimalScript({ steps: [
    { id: 'welcome', advance: { type: 'manual' } }
  ] }), 'script.steps[0].text'],
  ['campo desconhecido no roteiro', { ...minimalScript(), branches: [] }, 'script.branches'],
  ['campo desconhecido no passo', minimalScript({ steps: [
    { id: 'welcome', text: 'Olá', branch: 'other', advance: { type: 'manual' } }
  ] }), 'script.steps[0].branch'],
  ['timeout infinito', minimalScript({ steps: [
    { id: 'welcome', text: 'Olá', timeout: Infinity, advance: { type: 'manual' } }
  ] }), 'script.steps[0].timeout'],
  ['coordenada infinita', minimalScript({ steps: [
    { id: 'welcome', text: 'Olá', target: { x: Infinity, y: 1 }, advance: { type: 'manual' } }
  ] }), 'script.steps[0].target.x'],
  ['condição incompatível com manual', minimalScript({ steps: [
    { id: 'welcome', text: 'Olá', advance: { type: 'manual', condition: { kind: 'nonempty' } } }
  ] }), 'script.steps[0].advance.condition'],
  ['condição incompatível com click', minimalScript({ steps: [
    { id: 'welcome', target: '#button', text: 'Olá',
      advance: { type: 'click', condition: { kind: 'nonempty' } } }
  ] }), 'script.steps[0].advance.condition'],
  ['click com coordenada', minimalScript({ steps: [
    { id: 'welcome', target: { x: 1, y: 2 }, text: 'Olá', advance: { type: 'click' } }
  ] }), 'script.steps[0].target'],
  ['change com coordenada', minimalScript({ steps: [
    { id: 'welcome', target: { x: 1, y: 2 }, text: 'Olá', advance: { type: 'change' } }
  ] }), 'script.steps[0].target'],
  ['click sem alvo', minimalScript({ steps: [
    { id: 'welcome', text: 'Olá', advance: { type: 'click' } }
  ] }), 'script.steps[0].target'],
  ['laser sem alvo', minimalScript({ steps: [
    { id: 'welcome', text: 'Olá', laser: true, advance: { type: 'manual' } }
  ] }), 'script.steps[0].laser'],
  ['navegação automática sem rota', minimalScript({ steps: [
    { id: 'welcome', text: 'Olá', navigation: 'automatic', advance: { type: 'manual' } }
  ] }), 'script.steps[0].navigation'],
  ['dois tipos de áudio simultâneos', minimalScript({ steps: [
    { id: 'welcome', text: 'Olá', audio: { sound: 'beep', url: '/beep.mp3' },
      advance: { type: 'manual' } }
  ] }), 'script.steps[0].audio.url'],
  ['som desconhecido', minimalScript({ steps: [
    { id: 'welcome', text: 'Olá', audio: { sound: 'ring' }, advance: { type: 'manual' } }
  ] }), 'script.steps[0].audio.sound'],
  ['objeto com protótipo personalizado', Object.assign(Object.create(null), minimalScript()), 'script'],
  ['alvo ref com campo desconhecido', minimalScript({ steps: [
    { id: 'welcome', text: 'Olá', target: { ref: 'field', extra: true },
      advance: { type: 'manual' } }
  ] }), 'script.steps[0].target.extra'],
  ['condição equals sem valor', minimalScript({ steps: [
    { id: 'welcome', target: '#field', text: 'Olá',
      advance: { type: 'change', condition: { kind: 'equals' } } }
  ] }), 'script.steps[0].advance.condition.value'],
  ['condição checked sem booleano', minimalScript({ steps: [
    { id: 'welcome', target: '#field', text: 'Olá',
      advance: { type: 'change', condition: { kind: 'checked', value: 'true' } } }
  ] }), 'script.steps[0].advance.condition.value']
];

for (const [name, input, path] of invalidScripts) {
  test(`rejeita ${name} e identifica ${path}`, () => {
    assert.throws(() => normalizeScript(input), error => {
      assert.equal(error instanceof TypeError, true);
      assert.match(error.message, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      return true;
    });
  });
}

test('normaliza progresso compatível em uma cópia serializável', () => {
  const script = normalizeScript(minimalScript());
  const input = {
    schemaVersion: 1,
    trainingId: 'intro',
    version: 1,
    stepId: 'welcome',
    status: 'in-progress'
  };

  const result = normalizeProgress(input, script);
  input.status = 'cancelled';

  assert.deepEqual(result, {
    schemaVersion: 1,
    trainingId: 'intro',
    version: 1,
    stepId: 'welcome',
    status: 'in-progress'
  });
  assert.notStrictEqual(result, input);
});

for (const status of ['in-progress', 'completed', 'cancelled']) {
  test(`aceita progresso com status ${status}`, () => {
    const script = normalizeScript(minimalScript());
    assert.equal(normalizeProgress({
      schemaVersion: 1,
      trainingId: 'intro',
      version: 1,
      stepId: 'welcome',
      status
    }, script).status, status);
  });
}

const invalidProgress = [
  ['objeto não simples', [], 'progress'],
  ['campo desconhecido', {
    schemaVersion: 1, trainingId: 'intro', version: 1,
    stepId: 'welcome', status: 'completed', token: 'old'
  }, 'progress.token'],
  ['schemaVersion desconhecida', {
    schemaVersion: 2, trainingId: 'intro', version: 1,
    stepId: 'welcome', status: 'completed'
  }, 'progress.schemaVersion'],
  ['treinamento incompatível', {
    schemaVersion: 1, trainingId: 'other', version: 1,
    stepId: 'welcome', status: 'completed'
  }, 'progress.trainingId'],
  ['versão incompatível', {
    schemaVersion: 1, trainingId: 'intro', version: 2,
    stepId: 'welcome', status: 'in-progress'
  }, 'progress.version'],
  ['passo desconhecido', {
    schemaVersion: 1, trainingId: 'intro', version: 1,
    stepId: 'missing', status: 'in-progress'
  }, 'progress.stepId'],
  ['status desconhecido', {
    schemaVersion: 1, trainingId: 'intro', version: 1,
    stepId: 'welcome', status: 'paused'
  }, 'progress.status']
];

for (const [name, input, path] of invalidProgress) {
  test(`rejeita progresso com ${name} e identifica ${path}`, () => {
    const script = normalizeScript(minimalScript());
    assert.throws(() => normalizeProgress(input, script), error => {
      assert.equal(error instanceof TypeError, true);
      assert.match(error.message, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      return true;
    });
  });
}
