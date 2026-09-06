const SCRIPT_FIELDS = ['id', 'version', 'title', 'steps'];
const STEP_FIELDS = [
  'id', 'route', 'navigation', 'target', 'text', 'laser', 'audio', 'timeout', 'advance'
];
const PROGRESS_FIELDS = ['schemaVersion', 'trainingId', 'version', 'stepId', 'status'];
const AUDIO_SOUNDS = ['beep', 'success', 'error'];
const PROGRESS_STATUSES = ['in-progress', 'completed', 'cancelled'];

function invalid(path, message) {
  throw new TypeError(`${path}: ${message}`);
}

function keys(value, allowed, path) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) {
    invalid(path, 'expected a plain object');
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) invalid(`${path}.${key}`, 'unknown field');
  }
}

function has(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function nonemptyString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    invalid(path, 'expected a non-empty string');
  }
  return value;
}

function string(value, path) {
  if (typeof value !== 'string') invalid(path, 'expected a string');
  return value;
}

function positiveInteger(value, path) {
  if (!Number.isInteger(value) || value <= 0) {
    invalid(path, 'expected a positive integer');
  }
  return value;
}

function positiveFiniteNumber(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    invalid(path, 'expected a positive finite number');
  }
  return value;
}

function finiteNumber(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    invalid(path, 'expected a finite number');
  }
  return value;
}

function normalizeTarget(value, path) {
  if (typeof value === 'string') return nonemptyString(value, path);

  keys(value, ['ref', 'x', 'y'], path);
  if (has(value, 'ref')) {
    keys(value, ['ref'], path);
    return { ref: nonemptyString(value.ref, `${path}.ref`) };
  }

  if (!has(value, 'x')) invalid(`${path}.x`, 'required field');
  if (!has(value, 'y')) invalid(`${path}.y`, 'required field');
  return {
    x: finiteNumber(value.x, `${path}.x`),
    y: finiteNumber(value.y, `${path}.y`)
  };
}

function normalizeAudio(value, path) {
  keys(value, ['sound', 'url'], path);
  const hasSound = has(value, 'sound');
  const hasUrl = has(value, 'url');

  if (hasSound && hasUrl) invalid(`${path}.url`, 'cannot be combined with sound');
  if (!hasSound && !hasUrl) invalid(path, 'expected sound or url');
  if (hasSound) {
    if (!AUDIO_SOUNDS.includes(value.sound)) {
      invalid(`${path}.sound`, 'expected beep, success or error');
    }
    return { sound: value.sound };
  }
  return { url: nonemptyString(value.url, `${path}.url`) };
}

function normalizeCondition(value, path) {
  keys(value, ['kind', 'value'], path);
  if (!has(value, 'kind')) invalid(`${path}.kind`, 'required field');

  if (value.kind === 'nonempty') {
    keys(value, ['kind'], path);
    return { kind: 'nonempty' };
  }
  if (value.kind === 'equals') {
    if (!has(value, 'value')) invalid(`${path}.value`, 'required field');
    return { kind: 'equals', value: string(value.value, `${path}.value`) };
  }
  if (value.kind === 'checked') {
    if (!has(value, 'value')) invalid(`${path}.value`, 'required field');
    if (typeof value.value !== 'boolean') {
      invalid(`${path}.value`, 'expected a boolean');
    }
    return { kind: 'checked', value: value.value };
  }
  invalid(`${path}.kind`, 'expected nonempty, equals or checked');
}

function normalizeAdvance(value, path) {
  keys(value, ['type', 'name', 'condition'], path);
  if (!has(value, 'type')) invalid(`${path}.type`, 'required field');

  if (value.type === 'manual' || value.type === 'click') {
    keys(value, ['type'], path);
    return { type: value.type };
  }
  if (value.type === 'change') {
    keys(value, ['type', 'condition'], path);
    const advance = { type: 'change' };
    if (has(value, 'condition')) {
      advance.condition = normalizeCondition(value.condition, `${path}.condition`);
    }
    return advance;
  }
  if (value.type === 'signal') {
    keys(value, ['type', 'name'], path);
    if (!has(value, 'name')) invalid(`${path}.name`, 'required field');
    return { type: 'signal', name: nonemptyString(value.name, `${path}.name`) };
  }
  invalid(`${path}.type`, 'expected manual, click, change or signal');
}

function normalizeStep(value, index) {
  const path = `script.steps[${index}]`;
  keys(value, STEP_FIELDS, path);

  const step = {
    id: nonemptyString(value.id, `${path}.id`),
    navigation: has(value, 'navigation') ? value.navigation : 'user',
    text: nonemptyString(value.text, `${path}.text`),
    laser: has(value, 'laser') ? value.laser : false,
    timeout: has(value, 'timeout')
      ? positiveFiniteNumber(value.timeout, `${path}.timeout`)
      : 15000,
    advance: normalizeAdvance(value.advance, `${path}.advance`)
  };

  if (step.navigation !== 'user' && step.navigation !== 'automatic') {
    invalid(`${path}.navigation`, 'expected user or automatic');
  }
  if (typeof step.laser !== 'boolean') invalid(`${path}.laser`, 'expected a boolean');

  if (has(value, 'route')) step.route = nonemptyString(value.route, `${path}.route`);
  if (has(value, 'target')) step.target = normalizeTarget(value.target, `${path}.target`);
  if (has(value, 'audio')) step.audio = normalizeAudio(value.audio, `${path}.audio`);

  if (step.navigation === 'automatic' && !has(step, 'route')) {
    invalid(`${path}.navigation`, 'automatic navigation requires route');
  }
  if (step.laser && !has(step, 'target')) {
    invalid(`${path}.laser`, 'laser requires target');
  }
  if (step.advance.type === 'click' || step.advance.type === 'change') {
    if (!has(step, 'target')) invalid(`${path}.target`, `${step.advance.type} requires target`);
    if (typeof step.target !== 'string' && has(step.target, 'x')) {
      invalid(`${path}.target`, `${step.advance.type} requires an element target`);
    }
  }

  return step;
}

export function normalizeScript(value) {
  keys(value, SCRIPT_FIELDS, 'script');

  const script = {
    id: nonemptyString(value.id, 'script.id'),
    version: positiveInteger(value.version, 'script.version')
  };
  if (has(value, 'title')) script.title = string(value.title, 'script.title');

  if (!Array.isArray(value.steps) || value.steps.length === 0) {
    invalid('script.steps', 'expected a non-empty array');
  }

  const ids = new Set();
  script.steps = [];
  for (let index = 0; index < value.steps.length; index += 1) {
    const step = normalizeStep(value.steps[index], index);
    if (ids.has(step.id)) invalid(`script.steps[${index}].id`, 'duplicate step id');
    ids.add(step.id);
    script.steps.push(step);
  }
  return script;
}

export function normalizeProgress(value, script) {
  keys(value, PROGRESS_FIELDS, 'progress');
  const expected = normalizeScript(script);

  if (value.schemaVersion !== 1) {
    invalid('progress.schemaVersion', 'expected schema version 1');
  }
  if (value.trainingId !== expected.id) {
    invalid('progress.trainingId', 'does not match loaded training');
  }
  if (value.version !== expected.version) {
    invalid('progress.version', 'does not match loaded training version');
  }
  const stepId = nonemptyString(value.stepId, 'progress.stepId');
  if (!expected.steps.some(step => step.id === stepId)) {
    invalid('progress.stepId', 'unknown step');
  }
  if (!PROGRESS_STATUSES.includes(value.status)) {
    invalid('progress.status', 'expected in-progress, completed or cancelled');
  }

  return {
    schemaVersion: 1,
    trainingId: expected.id,
    version: expected.version,
    stepId,
    status: value.status
  };
}
