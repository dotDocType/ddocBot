import test from 'node:test';
import assert from 'node:assert/strict';
import { TrainingEngine } from '../src/training/engine.js';

const manual = (id, extra = {}) => ({ id, text: id, advance: { type: 'manual' }, ...extra });
const signalStep = (id = 'save', extra = {}) => manual(id, { advance: { type: 'signal', name: 'saved' }, ...extra });
const script = (...steps) => ({ id: 'training', version: 1, steps });

function setup(steps, options = {}) {
  const events = [];
  const effects = [];
  const engine = new TrainingEngine({
    emit: (name, detail) => events.push({ name, detail }),
    effect: value => effects.push(value),
    ...options
  });
  engine.load(script(...steps));
  return { engine, events, effects };
}

test('retomada invalida confirmação antiga e conclui apenas uma vez', () => {
  const { engine, events } = setup([signalStep()]);
  engine.start();
  engine.prepared(engine.token);
  const old = engine.token;
  engine.pause();
  engine.resume();
  engine.prepared(engine.token);
  assert.equal(engine.signal('saved', { token: old }), false);
  const token = engine.token;
  assert.equal(engine.signal('saved', { token }), true);
  assert.equal(engine.signal('saved', { token }), false);
  assert.equal(engine.state, 'completed');
  assert.equal(events.filter(e => e.name === 'ddocbot-trainingcomplete').length, 1);
});

test('sequência manual prepara cada passo e não aceita avanço prematuro', () => {
  const { engine } = setup([manual('one'), manual('two')]);
  assert.equal(engine.state, 'ready');
  assert.equal(engine.getProgress(), null);
  assert.equal(engine.start(), true);
  assert.equal(engine.state, 'presenting');
  assert.equal(engine.next(), false);
  assert.equal(engine.start(), false);
  const first = engine.token;
  assert.equal(engine.prepared(first), true);
  assert.equal(engine.next(), true);
  assert.equal(engine.currentStep.id, 'two');
  assert.notEqual(engine.token, first);
  assert.equal(engine.prepared(first), false);
  engine.prepared(engine.token);
  assert.equal(engine.next(), true);
  assert.equal(engine.running, false);
  assert.equal(engine.token, null);
  assert.equal(engine.start(), true);
  assert.equal(engine.currentStep.id, 'one');
});

for (const type of ['click', 'change', 'signal']) {
  test(`Próximo não contorna condição ${type}`, () => {
    const advance = type === 'signal' ? { type, name: 'saved' } : { type };
    const { engine } = setup([manual('practical', { target: '#field', advance })]);
    engine.start();
    engine.targetResolved(engine.token);
    engine.prepared(engine.token);
    assert.equal(engine.next(), false);
    assert.equal(engine.interaction(engine.token), type !== 'signal');
    if (type === 'signal') assert.equal(engine.signal('saved', { token: engine.token }), true);
    assert.equal(engine.state, 'completed');
  });
}

test('rota exige nome e token corretos e uma única confirmação por tentativa', () => {
  const { engine, effects, events } = setup([manual('one', { route: 'cadastro', target: '#field', navigation: 'automatic' })]);
  engine.start();
  const token = engine.token;
  assert.equal(engine.state, 'waiting-route');
  assert.equal(engine.routeReady('outra', { token }), false);
  assert.equal(engine.routeReady('cadastro', { token: 'old' }), false);
  assert.equal(effects.some(e => e.type === 'prepare'), false);
  assert.equal(events.at(-1).name, 'ddocbot-trainingroute');
  assert.equal(events.at(-1).detail.navigation, 'automatic');
  assert.equal(engine.routeReady('cadastro', { token }), true);
  assert.equal(engine.state, 'waiting-target');
  assert.equal(engine.routeReady('cadastro', { token }), false);
  assert.equal(effects.at(-1).type, 'prepare');
  assert.equal(engine.prepared(token), false);
  assert.equal(engine.targetResolved(token), true);
  assert.equal(engine.state, 'presenting');
  assert.equal(engine.targetResolved(token), false);
  assert.equal(engine.prepared(token), true);
});

test('timeout é compartilhado entre rota e alvo e exclui voo e aba oculta', () => {
  const { engine, events } = setup([manual('one', { route: 'form', target: '#field', timeout: 1000 })]);
  engine.start();
  engine.tick(600);
  engine.setVisible(false);
  engine.tick(99999);
  engine.setVisible(true);
  engine.routeReady('form', { token: engine.token });
  engine.tick(399);
  assert.equal(engine.state, 'waiting-target');
  engine.tick(1);
  assert.equal(engine.state, 'paused');
  assert.equal(events.find(e => e.name === 'ddocbot-trainingerror').detail.code, 'timeout');
  engine.tick(99999);
  engine.resume();
  engine.routeReady('form', { token: engine.token });
  engine.tick(999);
  assert.equal(engine.state, 'waiting-target');
  engine.targetResolved(engine.token);
  engine.tick(99999);
  assert.equal(engine.state, 'presenting');
  engine.prepared(engine.token);
  engine.tick(99999);
  assert.equal(engine.state, 'active');
});

test('Voltar de pausa prepara o anterior sem desfazer ações ou aceitar token velho', () => {
  const { engine, effects } = setup([manual('one'), manual('two')]);
  engine.start();
  assert.equal(engine.previous(), false);
  engine.prepared(engine.token);
  engine.next();
  const token = engine.token;
  engine.pause();
  assert.equal(engine.previous(), true);
  assert.equal(engine.currentStep.id, 'one');
  assert.equal(engine.state, 'presenting');
  assert.notEqual(engine.token, token);
  assert.equal(effects.at(-1).type, 'prepare');
  assert.equal(engine.getProgress().stepId, 'one');
});

test('pausa libera recursos antes de eventos e mantém token apenas consultável', () => {
  let engine;
  let released = false;
  engine = new TrainingEngine({
    effect: value => { if (value.type === 'release' && value.reason === 'user') released = true; },
    emit: (name, detail) => {
      if (name === 'ddocbot-trainingpause') {
        assert.equal(released, true);
        assert.equal(engine.state, 'paused');
        assert.equal(engine.signal('saved', { token: detail.token }), false);
      }
    }
  });
  engine.load(script(signalStep()));
  engine.start();
  engine.prepared(engine.token);
  const token = engine.token;
  assert.equal(engine.pause(), true);
  assert.equal(engine.token, token);
  assert.equal(engine.running, true);
  assert.equal(engine.pause(), false);
  assert.equal(engine.prepared(token), false);
  assert.equal(engine.interaction(token), false);
});

test('sinal válido oculto fica pendente uma vez e só avança ao reaparecer', () => {
  const { engine } = setup([signalStep()]);
  engine.start();
  assert.equal(engine.signal('saved', { token: engine.token }), false);
  engine.prepared(engine.token);
  const token = engine.token;
  engine.setVisible(false);
  assert.equal(engine.signal('wrong', { token }), false);
  assert.equal(engine.signal('saved', { token }), true);
  assert.equal(engine.signal('saved', { token }), false);
  assert.equal(engine.state, 'active');
  assert.equal(engine.token, token);
  engine.setVisible(true);
  assert.equal(engine.state, 'completed');
});

test('pausar descarta confirmação recebida em aba oculta', () => {
  const { engine } = setup([signalStep()]);
  engine.start();
  engine.prepared(engine.token);
  engine.setVisible(false);
  engine.signal('saved', { token: engine.token });
  engine.pause();
  engine.setVisible(true);
  assert.equal(engine.state, 'paused');
  engine.resume();
  engine.prepared(engine.token);
  assert.equal(engine.state, 'active');
});

test('rota pode ser confirmada oculta mas preparo espera visibilidade', () => {
  const { engine, effects } = setup([manual('one', { route: 'form', target: '#field' })]);
  engine.start();
  engine.setVisible(false);
  const token = engine.token;
  assert.equal(engine.routeReady('form', { token }), true);
  assert.equal(engine.routeReady('form', { token }), false);
  assert.equal(effects.some(e => e.type === 'prepare'), false);
  engine.setVisible(true);
  assert.equal(effects.at(-1).type, 'prepare');
  assert.equal(engine.token, token);
});

test('restauração de visibilidade revalida alvo e rearma escuta sem áudio novo', () => {
  const { engine, effects, events } = setup([manual('one', { target: '#field', audio: { sound: 'beep' } })]);
  engine.start();
  engine.targetResolved(engine.token);
  engine.prepared(engine.token);
  const token = engine.token;
  const activeEvents = events.filter(e => e.detail.state === 'active').length;
  const audioCount = effects.filter(e => e.type === 'audio').length;
  engine.setVisible(false);
  assert.equal(effects.at(-1).type, 'release');
  assert.equal(effects.at(-1).reason, 'hidden');
  assert.equal(engine.interaction(token), false);
  engine.setVisible(true);
  assert.equal(effects.at(-1).type, 'prepare');
  assert.equal(effects.at(-1).resume, true);
  assert.equal(engine.prepared(token), true);
  assert.equal(engine.prepared(token), false);
  assert.equal(effects.filter(e => e.type === 'audio').length, audioCount);
  assert.equal(events.filter(e => e.detail.state === 'active').length, activeEvents);
  assert.equal(engine.token, token);
});

test('routeChanged mantém espera e pausa preparação ou instrução', () => {
  const { engine, events } = setup([manual('one', { route: 'form', target: '#field' })]);
  engine.start();
  const token = engine.token;
  engine.routeChanged('form');
  assert.equal(engine.state, 'waiting-route');
  assert.equal(engine.token, token);
  engine.routeReady('form', { token });
  engine.routeChanged('elsewhere');
  assert.equal(engine.state, 'paused');
  assert.equal(events.at(-1).detail.reason, 'route-changed');
  assert.equal(events.some(e => e.name === 'ddocbot-trainingerror'), false);
  engine.resume();
  assert.equal(engine.state, 'waiting-route');
  assert.equal(events.filter(e => e.name === 'ddocbot-trainingroute').length, 2);
});

for (const code of ['target-lost', 'ambiguous-target', 'target-resolution-failed']) {
  test(`falha ${code} pausa com erro recuperável e rejeita callbacks antigos`, () => {
    const { engine, events } = setup([manual('one', { target: '#field' })]);
    engine.start();
    assert.equal(engine.fail(code, 'stale'), false);
    assert.equal(engine.fail(code, engine.token), true);
    assert.equal(engine.state, 'paused');
    assert.equal(events.at(-1).name, 'ddocbot-trainingerror');
    assert.equal(events.at(-1).detail.code, code);
    assert.ok(events.at(-1).detail.message.length > 0);
    assert.equal(engine.fail(code, engine.token), false);
  });
}

test('load e restauração são atômicos, cópias não alteram roteiro ou progresso', () => {
  const input = script(manual('one'), manual('two'));
  const engine = new TrainingEngine();
  engine.load(input);
  input.steps[0].advance.type = 'signal';
  assert.throws(() => engine.load({}), TypeError);
  engine.start();
  const step = engine.currentStep;
  assert.equal(step.total, 2);
  assert.equal(step.index, 0);
  step.advance.type = 'signal';
  assert.equal(engine.currentStep.advance.type, 'manual');
  assert.throws(() => engine.load(input), Error);
  assert.throws(() => engine.restoreProgress({}), Error);
  engine.prepared(engine.token);
  engine.next();
  engine.stop();
  const progress = engine.getProgress();
  assert.deepEqual(progress, { schemaVersion: 1, trainingId: 'training', version: 1, stepId: 'two', status: 'cancelled' });
  progress.stepId = 'one';
  assert.equal(engine.getProgress().stepId, 'two');
  assert.throws(() => engine.restoreProgress({ ...progress, version: 2 }), TypeError);
  assert.equal(engine.state, 'cancelled');
});

test('restauração em progresso cria sessão pausada sem navegar e retoma passo salvo', () => {
  const { engine, effects, events } = setup([manual('one'), manual('two', { route: 'form' })]);
  engine.restoreProgress({ schemaVersion: 1, trainingId: 'training', version: 1, stepId: 'two', status: 'in-progress' });
  assert.equal(engine.state, 'paused');
  assert.equal(engine.currentStep.id, 'two');
  assert.equal(engine.running, true);
  const token = engine.token;
  assert.equal(typeof token, 'string');
  assert.equal(events.some(e => e.name === 'ddocbot-trainingroute'), false);
  assert.equal(effects.some(e => e.type === 'prepare'), false);
  engine.resume();
  assert.notEqual(engine.token, token);
  assert.equal(engine.state, 'waiting-route');
});

for (const status of ['completed', 'cancelled']) {
  test(`restauração terminal ${status} não reemite evento histórico`, () => {
    const { engine, events, effects } = setup([manual('one')]);
    engine.restoreProgress({ schemaVersion: 1, trainingId: 'training', version: 1, stepId: 'one', status });
    assert.equal(engine.state, status);
    assert.equal(engine.token, null);
    assert.equal(events.some(e => /trainingcomplete$|trainingcancel$/.test(e.name)), false);
    assert.equal(effects.some(e => e.type === 'prepare'), false);
    assert.equal(engine.getProgress().status, status);
    assert.equal(engine.start(), true);
  });
}

test('confirmação síncrona de rota e sinal encontra estado pronto e escuta instalada', () => {
  let engine;
  let listening = false;
  const effects = [];
  engine = new TrainingEngine({
    effect: value => {
      effects.push(value);
      if (value.type === 'listen') listening = true;
    },
    emit: (name, detail) => {
      if (name === 'ddocbot-trainingroute') {
        assert.equal(engine.state, 'waiting-route');
        assert.equal(engine.routeReady(detail.route, { token: detail.token }), true);
      }
      if (name === 'ddocbot-trainingstatechange' && detail.state === 'active') {
        assert.equal(listening, true);
        assert.equal(engine.signal('saved', { token: detail.token }), true);
      }
    }
  });
  engine.load(script(signalStep('save', { route: 'form', audio: { sound: 'success' } })));
  engine.start();
  assert.equal(engine.state, 'presenting');
  engine.prepared(engine.token);
  assert.equal(engine.state, 'completed');
  assert.equal(effects.some(e => e.type === 'audio'), false);
});

test('handler de conclusão reinicia sem home tardio da sessão anterior', () => {
  let engine;
  const effects = [];
  const sessions = [];
  engine = new TrainingEngine({
    effect: value => effects.push(value),
    emit: (name, detail) => {
      if (name === 'ddocbot-trainingcomplete') {
        assert.equal(engine.state, 'completed');
        assert.equal(engine.running, false);
        sessions.push(detail.sessionId);
        assert.equal(engine.start(), true);
      }
    }
  });
  engine.load(script(manual('one')));
  engine.start();
  const old = engine.token;
  engine.prepared(old);
  engine.next();
  assert.equal(engine.state, 'presenting');
  assert.notEqual(engine.token, old);
  assert.equal(effects.some(e => e.type === 'home' && e.reason === 'completed'), false);
  engine.prepared(engine.token);
  engine.next();
  assert.notEqual(sessions[0], sessions[1]);
});

test('pause reentrante em listen impede active anunciado e áudio da tentativa', () => {
  let engine;
  const effects = [];
  const events = [];
  engine = new TrainingEngine({
    effect: value => {
      effects.push(value);
      if (value.type === 'listen') engine.pause();
    },
    emit: (name, detail) => events.push({ name, detail })
  });
  engine.load(script(manual('one', { audio: { sound: 'beep' } })));
  engine.start();
  engine.prepared(engine.token);
  assert.equal(engine.state, 'paused');
  assert.equal(events.some(e => e.detail.state === 'active'), false);
  assert.equal(effects.some(e => e.type === 'audio'), false);
});

test('stop reentrante em stepchange impede preparo antigo e snapshots são defensivos', () => {
  let engine;
  const effects = [];
  engine = new TrainingEngine({
    effect: value => {
      effects.push(value);
      if (value.step) value.step.text = 'corrupted';
      if (value.snapshot?.step) value.snapshot.step.text = 'corrupted';
    },
    emit: (name, detail) => {
      if (name === 'ddocbot-trainingstepchange') engine.stop();
      detail.trainingId = 'corrupted';
    }
  });
  engine.load(script(manual('one')));
  engine.start();
  assert.equal(engine.state, 'cancelled');
  assert.equal(engine.currentStep.text, 'one');
  assert.equal(engine.getProgress().trainingId, 'training');
  assert.equal(effects.some(e => e.type === 'prepare'), false);
});

test('liberação reentrante não permite efeitos da transição interrompida', () => {
  let engine;
  let reenter = false;
  const effects = [];
  engine = new TrainingEngine({ effect: value => {
    effects.push(value);
    if (value.type === 'release' && reenter) {
      reenter = false;
      engine.stop();
      engine.start();
    }
  } });
  engine.load(script(manual('one'), manual('two')));
  engine.start();
  engine.prepared(engine.token);
  reenter = true;
  engine.next();
  assert.equal(engine.currentStep.id, 'one');
  assert.equal(engine.state, 'presenting');
  assert.equal(effects.filter(e => e.type === 'prepare').at(-1).step.id, 'one');
});

test('tokens padrão diferem entre instâncias, reinícios e restaurações', () => {
  const a = setup([manual('one')]).engine;
  const b = setup([manual('one')]).engine;
  a.start();
  b.start();
  const old = a.token;
  assert.notEqual(a.token, b.token);
  a.stop();
  a.start();
  assert.notEqual(a.token, old);
  assert.equal(a.prepared(old), false);
});

test('destroy cancela com disconnected e remove roteiro, token e progresso', () => {
  const { engine, events, effects } = setup([signalStep()]);
  engine.start();
  const token = engine.token;
  engine.destroy();
  assert.equal(engine.state, 'idle');
  assert.equal(engine.token, null);
  assert.equal(engine.currentStep, null);
  assert.equal(engine.getProgress(), null);
  assert.equal(engine.running, false);
  assert.equal(engine.start(), false);
  assert.equal(engine.prepared(token), false);
  assert.equal(events.filter(e => e.name === 'ddocbot-trainingcancel').length, 1);
  assert.equal(events.find(e => e.name === 'ddocbot-trainingcancel').detail.reason, 'disconnected');
  assert.ok(effects.some(e => e.type === 'release' && e.token === token));
  engine.destroy();
  assert.equal(events.filter(e => e.name === 'ddocbot-trainingcancel').length, 1);
});

test('argumentos inválidos lançam TypeError mesmo fora de estado compatível', () => {
  const engine = new TrainingEngine();
  for (const call of [
    () => engine.signal('', { token: 't' }),
    () => engine.signal('saved'),
    () => engine.signal('saved', { token: 12 }),
    () => engine.routeReady('', { token: 't' }),
    () => engine.routeReady('form', {}),
    () => engine.routeChanged(null),
    () => engine.tick(-1),
    () => engine.tick(Infinity),
    () => engine.setVisible('false'),
    () => engine.load(script(manual('one')), { resolveTarget: 1 })
  ]) assert.throws(call, TypeError);
});

test('token nulo capturado sem tentativa retorna false para sinal e prontidão', () => {
  const engine = new TrainingEngine();
  assert.equal(engine.signal('saved', { token: engine.token }), false);
  assert.equal(engine.routeReady('form', { token: engine.token }), false);
  engine.load(script(signalStep()));
  engine.start();
  engine.prepared(engine.token);
  assert.equal(engine.signal('saved', { token: null }), false);
  assert.equal(engine.state, 'active');
});

test('clique estabelece espera da próxima rota antes do callback normal do roteador', () => {
  const { engine, events } = setup([
    manual('open', { target: '#link', advance: { type: 'click' } }),
    manual('form', { route: 'form' })
  ]);
  engine.start();
  engine.targetResolved(engine.token);
  engine.prepared(engine.token);
  const clickToken = engine.token;
  assert.equal(engine.interaction(clickToken), true);
  assert.equal(engine.state, 'waiting-route');
  assert.equal(events.at(-1).name, 'ddocbot-trainingroute');
  engine.routeChanged('form');
  assert.equal(engine.state, 'waiting-route');
  assert.equal(engine.interaction(clickToken), false);
  engine.routeReady('form', { token: engine.token });
  assert.equal(engine.next(), false);
});

test('cada passo e retomada solicita novamente a mesma rota', () => {
  const { engine, events } = setup([manual('one', { route: 'form' }), manual('two', { route: 'form' })]);
  engine.start();
  engine.routeReady('form', { token: engine.token });
  engine.prepared(engine.token);
  engine.next();
  engine.pause();
  engine.resume();
  const requests = events.filter(e => e.name === 'ddocbot-trainingroute');
  assert.equal(requests.length, 3);
  assert.equal(new Set(requests.map(e => e.detail.token)).size, 3);
  assert.deepEqual(requests.map(e => e.detail.stepId), ['one', 'two', 'two']);
});

test('makeToken reentrante que encerra a sessão não deixa retomada sobrescrevê-la', () => {
  let engine;
  let sequence = 0;
  let cancel = false;
  engine = new TrainingEngine({ makeToken: () => {
    if (cancel) engine.stop();
    return `custom-${++sequence}`;
  } });
  engine.load(script(manual('one')));
  engine.start();
  assert.equal(engine.token, 'custom-1');
  engine.pause();
  cancel = true;
  assert.equal(engine.resume(), false);
  assert.equal(engine.state, 'cancelled');
  assert.equal(engine.token, null);
});

test('cancelamento é único e destroy impede reinício síncrono durante desconexão', () => {
  let engine;
  const reasons = [];
  engine = new TrainingEngine({ emit: (name, detail) => {
    if (name === 'ddocbot-trainingcancel') {
      reasons.push(detail.reason);
      if (detail.reason === 'disconnected') assert.equal(engine.start(), false);
    }
  } });
  engine.load(script(manual('one')));
  engine.start();
  assert.equal(engine.stop(), true);
  assert.equal(engine.stop(), false);
  engine.start();
  engine.destroy();
  assert.deepEqual(reasons, ['user', 'disconnected']);
  assert.equal(engine.state, 'idle');
});
