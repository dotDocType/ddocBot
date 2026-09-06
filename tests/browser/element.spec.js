import {test,expect} from '@playwright/test';
test.beforeEach(async ({page}) => {
  await page.goto('/');
  await page.evaluate(async () => { const {defineDdocBot}=await import('/src/index.js'); defineDdocBot(); document.body.innerHTML='<dot-bot></dot-bot>'; window.bot=document.querySelector('dot-bot'); });
});
test('concurrent tasks remain active and report an error before returning to a dot',async({page})=>{
  await page.evaluate(()=>{window.states=[];bot.addEventListener('ddocbot-statechange',e=>states.push(e.detail.state));window.a=bot.beginTask();window.b=bot.beginTask();bot.endTask(a,{outcome:'error'});});
  await expect.poll(()=>page.evaluate(()=>bot.state)).toBe('processing');
  await page.evaluate(()=>bot.endTask(b,{outcome:'success'}));
  await expect.poll(()=>page.evaluate(()=>bot.state)).toBe('idle');
  expect(await page.evaluate(()=>states)).toContain('error');
});
test('text is safe, replaceable and duration zero stays visible',async({page})=>{
  await page.evaluate(()=>bot.say('<img src=x onerror=alert(1)>',{duration:0}));
  await expect(page.getByRole('status')).toHaveText('<img src=x onerror=alert(1)>');
  await page.evaluate(()=>bot.say('Segunda mensagem',{duration:0}));
  await expect(page.getByRole('status')).toHaveText('Segunda mensagem');
  await page.getByRole('button',{name:'Fechar mensagem'}).click();
  await expect(page.getByRole('status')).toBeHidden();
});
test('bubble expiry pauses on hover and resumes on leave',async({page})=>{
  await page.evaluate(()=>bot.say('Aguarde',{duration:700}));
  await page.getByRole('status').hover();
  await page.waitForTimeout(850);
  await expect(page.getByRole('status')).toBeVisible();
  await page.mouse.move(0,0);
  await expect(page.getByRole('status')).toBeHidden({timeout:2000});
});
test('keyboard activation, reduced motion and narrow screens',async({page})=>{
  await page.setViewportSize({width:240,height:480});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>{window.activations=0;bot.addEventListener('ddocbot-activate',()=>activations++);bot.movementWidth=900;bot.beginTask();bot.say('Texto muito longo '.repeat(60),{duration:0});});
  const trigger=page.getByRole('button',{name:'ddocBot, assistente'});
  await trigger.focus();await page.keyboard.press('Enter');
  expect(await page.evaluate(()=>activations)).toBe(1);
  const box=await trigger.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
  const bubble=await page.getByRole('status').boundingBox();expect(bubble.x).toBeGreaterThanOrEqual(0);expect(bubble.x+bubble.width).toBeLessThanOrEqual(240);
  await expect.poll(()=>page.evaluate(()=>bot.state)).toBe('processing');
  const before=await page.locator('canvas').getAttribute('style');await page.waitForTimeout(500);expect(await page.locator('canvas').getAttribute('style')).toBe(before);
});
test('muted sounds are harmless and failed audio emits an event',async({page})=>{
  expect(await page.evaluate(()=>bot.playSound('beep'))).toBe(false);
  await page.evaluate(()=>{window.errors=[];bot.addEventListener('ddocbot-audioerror',e=>errors.push(e.detail));const b=document.createElement('button');b.textContent='Enable test';b.onclick=()=>{window.enabled=bot.enableSound();};document.body.append(b);});
  await page.getByText('Enable test').click();
  expect(await page.evaluate(()=>window.enabled)).toBe(true);
  await page.evaluate(()=>bot.playAudio('/missing.wav'));
  await expect.poll(()=>page.evaluate(()=>errors.length)).toBeGreaterThan(0);
});
test('disconnect cleans up and reconnect starts idle',async({page})=>{
  await page.evaluate(()=>{for(let i=0;i<5;i++){bot.beginTask();bot.say('Hello');bot.remove();document.body.append(bot);}});
  expect(await page.evaluate(()=>bot.state)).toBe('idle');
  await expect(page.getByRole('status')).toBeHidden();
  await page.evaluate(()=>{window.id=bot.beginTask();bot.endTask(id,{outcome:'cancelled'});});
  await expect.poll(()=>page.evaluate(()=>bot.state)).toBe('idle');
});
test('replacement resets expiry and permanent replacements survive hover',async({page})=>{
  await page.evaluate(()=>{bot.say('First',{duration:2000});bot.say('Replacement',{duration:180});});
  await expect(page.getByRole('status')).toBeHidden({timeout:1500});
  await page.evaluate(()=>{bot.say('Timed',{duration:1000});bot.say('Permanent',{duration:0});});
  await page.getByRole('status').hover();await page.mouse.move(0,0);await page.waitForTimeout(250);
  await expect(page.getByRole('status')).toHaveText('Permanent');
});
test('opening event reports one pending task exactly once',async({page})=>{
  const states=await page.evaluate(()=>{const events=[];bot.addEventListener('ddocbot-statechange',e=>events.push(e.detail));bot.beginTask();return events;});
  expect(states).toEqual([{state:'opening',pendingTasks:1}]);
});
test('idle canvas repaints when the host or inherited color changes',async({page})=>{
  await page.waitForTimeout(100);
  const pixel=()=>page.locator('canvas').evaluate(c=>Array.from(c.getContext('2d').getImageData(8,8,1,1).data));
  await page.evaluate(()=>bot.style.color='rgb(255, 0, 0)');
  await expect.poll(pixel).toEqual([255,0,0,255]);
  await page.evaluate(()=>{bot.style.color='';document.body.style.color='rgb(0, 0, 255)';});
  await expect.poll(pixel).toEqual([0,0,255,255]);
});
test('bubble timeout also pauses while its close button has keyboard focus',async({page})=>{
  await page.evaluate(()=>bot.say('Leia com calma',{duration:400}));
  await page.getByRole('button',{name:'Fechar mensagem'}).focus();
  await page.waitForTimeout(550);await expect(page.getByRole('status')).toBeVisible();
  await page.getByRole('button',{name:'ddocBot, assistente'}).focus();
  await expect(page.getByRole('status')).toBeHidden({timeout:1500});
});
test('audio starts from a gesture, files play, and replacement stops previous audio',async({page})=>{
  await page.evaluate(()=>{
    window.filePlay=null;
    const button=document.createElement('button');button.textContent='Play fixture';
    button.onclick=async()=>{
      if(!await bot.enableSound())return;
      // One second of PCM silence, generated locally; no external audio or network.
      const buffer=new ArrayBuffer(16044), view=new DataView(buffer);
      const text=(offset,s)=>[...s].forEach((c,i)=>view.setUint8(offset+i,c.charCodeAt(0)));
      text(0,'RIFF');view.setUint32(4,16036,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,8000,true);view.setUint32(28,16000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,16000,true);
      window.fixtureUrl=URL.createObjectURL(new Blob([buffer],{type:'audio/wav'}));
      window.filePlay=bot.playAudio(fixtureUrl);
    };document.body.append(button);
  });
  await page.getByText('Play fixture').click();
  await expect.poll(()=>page.evaluate(()=>filePlay!==null)).toBe(true);
  expect(await page.evaluate(()=>filePlay)).toBe(true);
  // Resource ownership is inspected here to verify actual playback cleanup.
  expect(await page.evaluate(()=>{window.channel=bot._audio.channel;return channel.paused;})).toBe(false);
  expect(await page.evaluate(()=>bot.playSound('success'))).toBe(true);
  expect(await page.evaluate(()=>channel.paused)).toBe(true);
  await page.evaluate(()=>{bot.stopAudio();URL.revokeObjectURL(fixtureUrl);});
});
