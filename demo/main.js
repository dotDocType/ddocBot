import { setupTrainingDemo } from './training.js';
import { defineDdocBot } from '../src/index.js';
defineDdocBot();
const $ = id => document.getElementById(id);
const bot = $('ddocbot');
// Keep the original drawing surface: navigation temporarily portals it to <body>.
const botCanvas = bot.shadowRoot.querySelector('canvas');
const tasks = [];
const names = { idle: 'Em repouso', opening: 'Despertando', processing: 'Processando', success: 'Tudo certo!', error: 'Ops, um erro', closing: 'Até já' };
function refresh() {
  $('live-state').textContent = names[bot.state];
  $('task-count').textContent = tasks.length ? `${tasks.length} tarefa${tasks.length > 1 ? 's' : ''} em andamento` : 'Nenhuma tarefa em andamento';
  $('success').disabled = $('error').disabled = !tasks.length;
  $('task-light').style.background = tasks.length ? '#34d399' : '';
}
function begin() { tasks.push(bot.beginTask()); refresh(); }
$('start').onclick = begin;
$('concurrent').onclick = () => { begin(); begin(); };
function end(outcome) { const id = tasks.shift(); if (id) bot.endTask(id, { outcome }); refresh(); }
$('success').onclick = () => end('success'); $('error').onclick = () => end('error');
bot.addEventListener('ddocbot-statechange', refresh);
bot.addEventListener('ddocbot-activate', () => bot.say('Olá! Sou o ddocBot. Pode contar comigo.'));
$('say').onclick = () => bot.say($('message').value);
$('message').addEventListener('keydown', event => { if (event.key === 'Enter') bot.say(event.target.value); });
$('color').oninput = event => { bot.style.color = event.target.value; $('color-value').textContent = event.target.value.toUpperCase(); };
$('width').oninput = event => { bot.movementWidth = Number(event.target.value); $('width-value').textContent = `${event.target.value} px`; };
$('sound').onclick = async () => {
  if (!bot.muted) bot.muted = true;
  else await bot.enableSound();
  $('sound').setAttribute('aria-pressed', String(!bot.muted));
  $('sound').innerHTML = `<span>♫</span> ${bot.muted ? 'Ativar som' : 'Som ativado'}`;
  $('beep').disabled = bot.muted;
};
$('beep').onclick = () => bot.playSound('beep');
$('alert-sound').onchange = async event => {
  bot.alertSound = event.target.value || null;
  if (bot.alertSound && bot.muted) await bot.enableSound();
  $('sound').setAttribute('aria-pressed', String(!bot.muted));
  $('sound').innerHTML = `<span>♫</span> ${bot.muted ? 'Ativar som' : 'Som ativado'}`;
  $('beep').disabled = bot.muted;
  setNavigationFeedback(bot.alertSound ? (bot.muted ? 'Ative o som para ouvir os alertas.' : 'O alerta tocará enquanto o laser estiver visível.') : 'Alerta visual, sem som.');
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
  if (bot.muted) { $('audio-feedback').textContent = 'Ative o som e selecione o arquivo novamente.'; event.target.value = ''; return; }
  $('audio-feedback').textContent = ''; await bot.playAudio(audioUrl);
};
bot.addEventListener('ddocbot-audioerror', () => { $('audio-feedback').textContent = 'Não foi possível reproduzir. Ative o som ou tente outro arquivo.'; });
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText($('snippet').textContent); $('copy').textContent = 'Copiado ✓'; }
  catch { $('copy').textContent = 'Selecione o código'; }
};
function selectedTarget() {
  if ($('guide-target').value === 'coordinates') return { x: Number($('guide-x').value), y: Number($('guide-y').value) };
  return $('guide-target').value;
}
function setNavigationFeedback(message) { $('navigation-feedback').textContent = message; }
$('guide-fly').onclick = async () => {
  setNavigationFeedback('Voando até o alvo…');
  const result = await bot.flyTo(selectedTarget());
  setNavigationFeedback(result === 'arrived' ? 'Cheguei ao alvo.' : result === 'cancelled' ? 'Voo cancelado.' : 'Alvo indisponível.');
};
$('guide-point').onclick = () => setNavigationFeedback(bot.pointAt(selectedTarget()) ? 'Laser apontado para o alvo.' : 'Não foi possível apontar para o alvo.');
$('guide-stop').onclick = () => { bot.stopPointing(); setNavigationFeedback('Laser desligado.'); };
$('guide-home').onclick = async () => {
  setNavigationFeedback('Voltando ao rodapé…');
  const result = await bot.returnHome();
  setNavigationFeedback(result === 'arrived' ? 'De volta ao rodapé.' : 'Retorno cancelado.');
};
bot.addEventListener('ddocbot-navigationchange', event => { $('navigation-state').textContent = event.detail.state; });
bot.addEventListener('ddocbot-targetlost', event => { setNavigationFeedback(`Alvo perdido: ${event.detail.reason}.`); });
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

setupTrainingDemo(bot);
