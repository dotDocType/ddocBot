import type { DdocBotElement, TrainingScript, TrainingProgress } from '../../src/index.js';
declare const bot: DdocBotElement;
const script: TrainingScript = { id: 'intro', version: 1, steps: [
  { id: 'welcome', text: 'Olá', advance: { type: 'manual' } },
  { id: 'save', text: 'Salve', target: { ref: 'save' },
    advance: { type: 'signal', name: 'saved' } }
] };
bot.training.load(script, { resolveTarget(ref, { stepId }) {
  const id: string = stepId;
  return document.querySelector(`[data-tour="${ref}-${id}"]`);
} });
const accepted: boolean = bot.training.start();
const token = bot.training.token;
const signalled: boolean = bot.training.signal('saved', { token });
bot.training.routeReady('form', { token });
bot.training.message('Confira', { token, duration: 0 });
const progress: TrainingProgress | null = bot.training.getProgress();
if (progress) bot.training.restoreProgress(progress);
bot.addEventListener('ddocbot-trainingstatechange', event => {
  const state: string = event.detail.state;
  void state;
});
bot.addEventListener('ddocbot-trainingroute', event => {
  const route: string = event.detail.route;
  bot.training.routeReady(route, { token: event.detail.token });
});
// @ts-expect-error controller is read only
bot.training = {};
// @ts-expect-error no branching in this version
const bad: TrainingScript = { ...script, branches: [] };
// @ts-expect-error only documented advancement types
const badStep: TrainingScript = { id: 'x', version: 1, steps: [{ id: 'x', text: 'x', advance: { type: 'timer' } }] };
// @ts-expect-error click requires an element, not coordinates
const badClick: TrainingScript = { id: 'x', version: 1, steps: [{ id: 'x', text: 'x', target: { x: 1, y: 2 }, advance: { type: 'click' } }] };
// @ts-expect-error audio cannot specify both sources
const badAudio: TrainingScript = { id: 'x', version: 1, steps: [{ id: 'x', text: 'x', audio: { sound: 'beep', url: '/a.mp3' }, advance: { type: 'manual' } }] };
void accepted; void signalled; void bad; void badStep; void badClick; void badAudio;
// @ts-expect-error pointing laser requires a target
const badLaser: TrainingScript = { id: 'x', version: 1, steps: [{ id: 'x', text: 'x', laser: true, advance: { type: 'manual' } }] };
function exhaustiveProgress(value: TrainingProgress): void {
  switch (value.status) {
    case 'in-progress': return;
    case 'completed': return;
    case 'cancelled': return;
    default: { const neverValue: never = value; void neverValue; }
  }
}
void badLaser; void exhaustiveProgress;
