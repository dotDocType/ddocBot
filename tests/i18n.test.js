import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_LOCALE,
  LOCALES,
  detectLocale,
  nextLocale,
  translate,
  localeFlag
} from '../demo/i18n.js';
import { trainingLabels } from '../src/training/view.js';

test('detecta o primeiro idioma suportado do ambiente', () => {
  assert.equal(detectLocale({ languages: ['fr-FR', 'es-MX'] }), 'es');
  assert.equal(detectLocale({ languages: ['en-GB', 'pt-BR'] }), 'en');
  assert.equal(detectLocale({ languages: ['pt-PT'] }), 'pt-BR');
  assert.equal(detectLocale({ languages: ['de-DE'] }), DEFAULT_LOCALE);
});

test('preferência salva tem prioridade sobre a configuração do ambiente', () => {
  assert.equal(detectLocale({ storedLocale: 'es', languages: ['en-US'] }), 'es');
  assert.equal(detectLocale({ storedLocale: 'fr', languages: ['en-US'] }), 'en');
});

test('troca de idioma percorre as três opções e volta ao início', () => {
  assert.deepEqual(LOCALES, ['pt-BR', 'en', 'es']);
  assert.equal(nextLocale('pt-BR'), 'en');
  assert.equal(nextLocale('en'), 'es');
  assert.equal(nextLocale('es'), 'pt-BR');
});

test('dicionário traduz texto, interpolação, bandeira e fallback', () => {
  assert.equal(translate('en', 'header.integration'), 'How to integrate');
  assert.equal(translate('es', 'task.count', { count: 2 }), '2 tareas en curso');
  assert.equal(localeFlag('pt-BR'), '🇧🇷');
  assert.equal(translate('en', 'missing.key'), 'missing.key');
});

test('controles internos do treinamento acompanham o idioma da demo', () => {
  assert.equal(trainingLabels('en').next, 'Next');
  assert.equal(trainingLabels('es').pause, 'Pausar');
  assert.equal(trainingLabels('pt-BR').previous, 'Voltar');
});
