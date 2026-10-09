import { setupTrainingDemo } from './training.js';
import { applyTranslations, createLocaleManager, localeFlag, nextLocale, translate } from './i18n.js';
import { defineDdocBot } from '../src/index.js';

defineDdocBot();
const $ = id => document.getElementById(id);
const bot = $('ddocbot');
const localeManager = createLocaleManager();
const t = (key, variables = {}) => translate(localeManager.locale, key, variables);
// Keep the original drawing surface: navigation temporarily portals it to <body>.
const botCanvas = bot.shadowRoot.querySelector('canvas');
const tasks = [];
const stateKeys = { idle: 'idle', opening: 'opening', processing: 'processing', success: 'success', error: 'error', closing: 'closing' };
let navigationFeedback = { key: 'guidance.ready', variables: {} };
let localeApplied = false;

function refresh() {
  $('live-state').textContent = t(`stage.state.${stateKeys[bot.state]}`);
  $('task-count').textContent = tasks.length ? t('task.count', { count: tasks.length }) : t('task.none');
  $('success').disabled = $('error').disabled = !tasks.length;
  $('task-light').style.background = tasks.length ? '#34d399' : '';
}

function refreshSoundLabel() {
  $('sound-label').textContent = t(bot.muted ? 'controls.soundOn' : 'controls.soundOff');
  $('sound').setAttribute('aria-pressed', String(!bot.muted));
  $('beep').disabled = bot.muted;
}

function setNavigationFeedback(key, variables = {}) {
  navigationFeedback = { key, variables };
  $('navigation-feedback').textContent = t(key, variables);
}

function applyLocale() {
  const locale = localeManager.locale;
  const messageValue = localeApplied ? $('message').value : null;
  const guideValue = localeApplied ? $('guide-input').value : null;
  document.documentElement.lang = locale;
  document.title = t('page.title');
  bot.locale = locale;
  applyTranslations(document, locale);
  if (localeApplied) {
    $('message').value = messageValue;
    $('guide-input').value = guideValue;
  }
  $('snippet').textContent = t('details.snippet');
  $('language-flag').textContent = localeFlag(locale);
  const next = nextLocale(locale);
  const switchLabel = t('header.switchLanguage', { locale: next });
  $('language-switch').setAttribute('aria-label', switchLabel);
  $('language-switch').title = switchLabel;
  $('live-state').textContent = t(`stage.state.${stateKeys[bot.state]}`);
  refreshSoundLabel();
  $('navigation-feedback').textContent = t(navigationFeedback.key, navigationFeedback.variables);
  refresh();
  localeApplied = true;
}

localeManager.subscribe(applyLocale);
$('language-switch').onclick = () => localeManager.next();

function begin() { tasks.push(bot.beginTask()); refresh(); }
$('start').onclick = begin;
$('concurrent').onclick = () => { begin(); begin(); };
function end(outcome) { const id = tasks.shift(); if (id) bot.endTask(id, { outcome }); refresh(); }
$('success').onclick = () => end('success');
$('error').onclick = () => end('error');
bot.addEventListener('ddocbot-statechange', refresh);
bot.addEventListener('ddocbot-activate', () => bot.say(t('bot.greeting')));
$('say').onclick = () => bot.say($('message').value);
$('message').addEventListener('keydown', event => { if (event.key === 'Enter') bot.say(event.target.value); });
$('color').oninput = event => { bot.style.color = event.target.value; $('color-value').textContent = event.target.value.toUpperCase(); };
$('width').oninput = event => { bot.movementWidth = Number(event.target.value); $('width-value').textContent = `${event.target.value} px`; };
$('sound').onclick = async () => {
  if (!bot.muted) bot.muted = true;
  else await bot.enableSound();
  refreshSoundLabel();
};
$('beep').onclick = () => bot.playSound('beep');
$('alert-sound').onchange = async event => {
  bot.alertSound = event.target.value || null;
  if (bot.alertSound && bot.muted) await bot.enableSound();
  refreshSoundLabel();
  setNavigationFeedback(bot.alertSound ? (bot.muted ? 'guidance.soundHint' : 'guidance.alertHint') : 'guidance.visualHint');
};
$('alert-interval').onchange = event => {
  const interval = Number(event.target.value);
  if (!Number.isFinite(interval)) return;
  bot.alertInterval = interval;
  event.target.value = String(bot.alertInterval);
};

let audioUrl;
$('audio-file').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  bot.stopAudio(); if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = URL.createObjectURL(file);
  if (bot.muted) { $('audio-feedback').textContent = t('controls.audioMuted'); event.target.value = ''; return; }
  $('audio-feedback').textContent = ''; await bot.playAudio(audioUrl);
};
bot.addEventListener('ddocbot-audioerror', () => { $('audio-feedback').textContent = t('controls.audioError'); });
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText($('snippet').textContent); $('copy').textContent = t('details.copied'); }
  catch { $('copy').textContent = t('details.copyFallback'); }
};
function selectedTarget() {
  if ($('guide-target').value === 'coordinates') return { x: Number($('guide-x').value), y: Number($('guide-y').value) };
  return $('guide-target').value;
}
$('guide-fly').onclick = async () => {
  setNavigationFeedback('guidance.flying');
  const result = await bot.flyTo(selectedTarget());
  setNavigationFeedback(result === 'arrived' ? 'guidance.arrived' : result === 'cancelled' ? 'guidance.cancelled' : 'guidance.unavailable');
};
$('guide-point').onclick = () => setNavigationFeedback(bot.pointAt(selectedTarget()) ? 'guidance.pointed' : 'guidance.pointFailed');
$('guide-stop').onclick = () => { bot.stopPointing(); setNavigationFeedback('guidance.stopped'); };
$('guide-home').onclick = async () => {
  setNavigationFeedback('guidance.returning');
  const result = await bot.returnHome();
  setNavigationFeedback(result === 'arrived' ? 'guidance.returned' : 'guidance.cancelled');
};
bot.addEventListener('ddocbot-navigationchange', event => { $('navigation-state').textContent = event.detail.state; });
bot.addEventListener('ddocbot-targetlost', event => { setNavigationFeedback('guidance.lost', { reason: event.detail.reason }); });
const preview = $('pixel-preview').getContext('2d');
preview.imageSmoothingEnabled = false;
let previewFrame;
function renderPreview() {
  const rect = botCanvas.getBoundingClientRect();
  preview.clearRect(0, 0, 24, 24); preview.drawImage(botCanvas, 0, 0);
  $('position').textContent = `X: ${Math.round(rect.left + scrollX)} · Y: ${Math.round(rect.top + scrollY)}`;
  previewFrame = requestAnimationFrame(renderPreview);
}
renderPreview();
document.addEventListener('visibilitychange', () => { cancelAnimationFrame(previewFrame); if (!document.hidden) renderPreview(); });
window.addEventListener('pagehide', () => { cancelAnimationFrame(previewFrame); bot.stopAudio(); if (audioUrl) URL.revokeObjectURL(audioUrl); });

setupTrainingDemo(bot, { localeManager });
applyLocale();
