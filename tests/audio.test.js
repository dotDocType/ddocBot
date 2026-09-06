import {test} from 'node:test';
import assert from 'node:assert/strict';
const mod=await import('../src/audio.js').catch(()=>({}));
test('audio starts muted without constructing browser resources',async()=>{
 assert.equal(typeof mod.BotAudio,'function');
 const audio=new mod.BotAudio(()=>{});
 assert.equal(await audio.playSound('beep'),false);
 assert.equal(await audio.playAudio('sound.wav'),false);
 assert.equal(audio.context,null);
 audio.destroy();
});
test('audio volume is clamped and rejects non-finite values',()=>{
 assert.equal(typeof mod.BotAudio,'function');const audio=new mod.BotAudio(()=>{});
 audio.volume=2;assert.equal(audio.volume,1);audio.volume=-1;assert.equal(audio.volume,0);
 assert.throws(()=>audio.volume=NaN,TypeError);
});
test('late file errors are reported once and stale channels cannot report after stop',async()=>{
 // HTML media cannot run in Node: substitute only its asynchronous boundary.
 const previous=globalThis.Audio;
 class Media extends EventTarget {constructor(){super();Media.last=this;}play(){return Promise.resolve();}pause(){}removeAttribute(){}load(){}}
 globalThis.Audio=Media;
 try {
  const errors=[];const audio=new mod.BotAudio(e=>errors.push(e));audio.context={};audio.muted=false;
  assert.equal(await audio.playAudio('fixture.wav'),true);
  const media=Media.last;media.dispatchEvent(new Event('error'));media.dispatchEvent(new Event('error'));
  assert.equal(errors.length,1);assert.equal(errors[0].kind,'file');
  await audio.playAudio('second.wav');const second=Media.last;audio.stop();second.dispatchEvent(new Event('error'));
  assert.equal(errors.length,1);
 } finally {globalThis.Audio=previous;}
});
test('training owns pending media immediately and never stops a newer external channel', async () => {
 const previous = globalThis.Audio;
 class Media extends EventTarget {
  constructor() { super(); this.paused = true; Media.last = this; }
  play() { this.paused = false; return new Promise(resolve => { this.resolve = resolve; }); }
  pause() { this.paused = true; } removeAttribute() {} load() {}
 }
 globalThis.Audio = Media;
 try {
  const audio = new mod.BotAudio(() => {}); audio.context = {}; audio.muted = false;
  const first = audio.playTraining({ url: 'first.wav' }); const firstMedia = Media.last;
  audio.stopTraining(); assert.equal(firstMedia.paused, true); assert.equal(audio.channel, null);
  firstMedia.resolve(); assert.equal(await first, false);
  const second = audio.playTraining({ url: 'second.wav' }); const secondMedia = Media.last;
  const external = audio.playAudio('external.wav'); const externalMedia = Media.last;
  audio.stopTraining(); assert.equal(externalMedia.paused, false); assert.equal(audio.channel, externalMedia);
  secondMedia.resolve(); externalMedia.resolve();
  assert.equal(await second, false); assert.equal(await external, true);
  assert.equal(await audio.playTraining({ url: 'blocked.wav' }), false);
  assert.equal(audio.channel, externalMedia); audio.stop();
 } finally { globalThis.Audio = previous; }
});
test('training audio is unavailable until explicitly enabled', async () => {
 const audio = new mod.BotAudio(() => {});
 assert.equal(await audio.playTraining({ sound: 'beep' }), false);
 audio.stopTraining(); assert.equal(audio.context, null);
});
