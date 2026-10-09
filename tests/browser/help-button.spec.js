import {test,expect} from '@playwright/test';
const isHelp = page => page.evaluate(() => bot.shadowRoot.querySelector('.trigger')?.classList.contains('is-help') ?? false);
const triggerLeft = page => page.evaluate(() => parseFloat(bot.shadowRoot.querySelector('.trigger').style.left));
test.beforeEach(async ({page}) => {
  await page.goto('/');
  await page.evaluate(async () => { const {defineDdocBot}=await import('/src/index.js'); defineDdocBot(); document.body.innerHTML='<dot-bot help-button style="color: rgb(56, 99, 75)"></dot-bot>'; window.bot=document.querySelector('dot-bot'); });
});
test('attribute and property stay in sync and the mode is off by default',async({page})=>{
  expect(await page.evaluate(()=>bot.helpButton)).toBe(true);
  expect(await isHelp(page)).toBe(true);
  await expect(page.getByRole('button',{name:'Ajuda'})).toBeVisible();
  await page.evaluate(()=>bot.removeAttribute('help-button'));
  expect(await page.evaluate(()=>bot.helpButton)).toBe(false);
  expect(await isHelp(page)).toBe(false);
  expect(await page.evaluate(()=>bot.shadowRoot.querySelector('canvas').classList.contains('is-hidden'))).toBe(false);
  await expect(page.getByRole('button',{name:'ddocBot, assistente'})).toBeVisible();
  await page.evaluate(()=>{bot.helpButton=true;});
  expect(await page.evaluate(()=>bot.hasAttribute('help-button'))).toBe(true);
  expect(await isHelp(page)).toBe(true);
  const plain=await page.evaluate(()=>{const b=document.createElement('dot-bot');document.body.append(b);const r={on:b.helpButton,attr:b.hasAttribute('help-button'),help:b.shadowRoot.querySelector('.trigger').classList.contains('is-help'),hidden:b.shadowRoot.querySelector('canvas').classList.contains('is-hidden')};b.remove();return r;});
  expect(plain).toEqual({on:false,attr:false,help:false,hidden:false});
});
test('activation shows the dot and the "?" returns after the delay',async({page})=>{
  await page.evaluate(()=>{window.activations=0;bot.addEventListener('ddocbot-activate',()=>activations++);});
  await page.getByRole('button',{name:'Ajuda'}).click();
  expect(await page.evaluate(()=>activations)).toBe(1);
  expect(await isHelp(page)).toBe(false);
  expect(await page.evaluate(()=>bot.shadowRoot.querySelector('canvas').classList.contains('is-hidden'))).toBe(false);
  await expect(page.getByRole('button',{name:'ddocBot, assistente'})).toBeVisible();
  await page.waitForTimeout(1000);
  expect(await isHelp(page)).toBe(false);
  await expect.poll(()=>isHelp(page),{timeout:3000}).toBe(true);
});
test('keyboard activation works like a click',async({page})=>{
  await page.evaluate(()=>{window.activations=0;bot.addEventListener('ddocbot-activate',()=>activations++);});
  await page.getByRole('button',{name:'Ajuda'}).focus();
  await page.keyboard.press('Space');
  expect(await page.evaluate(()=>activations)).toBe(1);
  expect(await isHelp(page)).toBe(false);
});
test('a message inside the delay keeps the bot and restarts the delay',async({page})=>{
  await page.getByRole('button',{name:'Ajuda'}).click();
  // The bubble closes at ~1200 ms; a delay that kept counting from the click would show "?" at ~1500 ms.
  await page.evaluate(()=>bot.say('Oi',{duration:1200}));
  await page.waitForTimeout(2000);
  expect(await isHelp(page)).toBe(false);
  await expect.poll(()=>isHelp(page),{timeout:3000}).toBe(true);
});
test('the "?" sits at the right edge and returns there after the bot moved',async({page})=>{
  expect(await triggerLeft(page)).toBe(160-24-10);
  await page.evaluate(()=>{bot.movementWidth=200;});
  await expect.poll(()=>triggerLeft(page)).toBe(200-24-10);
  // Simulate a walk that ended at the left edge of the band (engine x is internal).
  await page.evaluate(()=>{window.id=bot.beginTask();bot._engine.x=0;bot.endTask(id,{outcome:'cancelled'});});
  // beginTask/endTask only schedule a frame; wait for the bot before waiting for the "?" again.
  await expect.poll(()=>isHelp(page)).toBe(false);
  await expect.poll(()=>isHelp(page),{timeout:3000}).toBe(true);
  expect(await triggerLeft(page)).toBe(200-24-10);
  await page.evaluate(()=>{bot.helpButton=false;window.id2=bot.beginTask();bot._engine.x=0;bot.endTask(id2,{outcome:'cancelled'});});
  await expect.poll(()=>page.evaluate(()=>bot.state)).toBe('idle');
  expect(await triggerLeft(page)).toBe(-10);
});
test('trigger label follows appearance and locale',async({page})=>{
  await page.evaluate(()=>{bot.locale='en';});
  await expect(page.getByRole('button',{name:'Help'})).toBeVisible();
  await page.evaluate(()=>{bot.locale='es';});
  await expect(page.getByRole('button',{name:'Ayuda'})).toBeVisible();
  await page.evaluate(()=>bot.say('Hola',{duration:0}));
  await expect(page.getByRole('button',{name:'ddocBot, asistente'})).toBeVisible();
});
test('flight from the help icon lands back on it',async({page})=>{
  await page.evaluate(()=>{const t=document.createElement('div');t.id='target';t.style.cssText='position:absolute;left:100px;top:100px;width:40px;height:40px';document.body.append(t);});
  expect(await page.evaluate(()=>bot.flyTo('#target',{duration:100}))).toBe('arrived');
  expect(await page.evaluate(()=>document.querySelector('[data-ddocbot-layer]').shadowRoot.querySelector('.trigger').classList.contains('is-help'))).toBe(false);
  expect(await page.evaluate(()=>bot.returnHome({duration:100}))).toBe('arrived');
  await expect.poll(()=>isHelp(page),{timeout:3000}).toBe(true);
  expect(await triggerLeft(page)).toBe(160-24-10);
});
test('reduced motion swaps without transitions',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  const durations=await page.evaluate(()=>[bot.shadowRoot.querySelector('.help'),bot.shadowRoot.querySelector('canvas')].map(n=>getComputedStyle(n).transitionDuration));
  for (const value of durations) expect(value.split(',').every(v=>parseFloat(v)===0)).toBe(true);
});
test('icon color follows the host color and hides the canvas',async({page})=>{
  const fill=()=>page.evaluate(()=>getComputedStyle(bot.shadowRoot.querySelector('.help path')).fill);
  expect(await fill()).toBe('rgb(56, 99, 75)');
  await page.evaluate(()=>{bot.style.color='rgb(200, 0, 0)';});
  expect(await fill()).toBe('rgb(200, 0, 0)');
  expect(await page.evaluate(()=>bot.shadowRoot.querySelector('canvas').classList.contains('is-hidden'))).toBe(true);
  expect(await page.evaluate(()=>bot.shadowRoot.querySelector('.help path').getAttribute('fill-rule'))).toBe('evenodd');
});
const nudging = page => page.evaluate(() => bot.shadowRoot.querySelector('.help')?.classList.contains('nudge') ?? false);
test('nudge plays while the "?" is shown and restarts when repeated',async({page})=>{
  expect(await page.evaluate(()=>bot.nudge())).toBe(true);
  expect(await nudging(page)).toBe(true);
  await page.waitForTimeout(500);
  expect(await page.evaluate(()=>bot.nudge())).toBe(true);
  expect(await page.evaluate(()=>bot.shadowRoot.querySelector('.help i').getAnimations()[0]?.currentTime ?? 0)).toBeLessThan(200);
  await expect.poll(()=>nudging(page),{timeout:3000}).toBe(false);
});
test('nudge is refused when the "?" is not shown',async({page})=>{
  await page.getByRole('button',{name:'Ajuda'}).click();
  expect(await page.evaluate(()=>bot.nudge())).toBe(false);
  await expect.poll(()=>isHelp(page),{timeout:3000}).toBe(true);
  await page.evaluate(()=>bot.say('Oi',{duration:0}));
  expect(await page.evaluate(()=>bot.nudge())).toBe(false);
  await page.evaluate(()=>{bot.dismissBubble();bot.helpButton=false;});
  expect(await page.evaluate(()=>bot.nudge())).toBe(false);
  await page.evaluate(()=>{bot.helpButton=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});});
  expect(await page.evaluate(()=>bot.nudge())).toBe(false);
  await page.evaluate(()=>{delete document.hidden;});
  expect(await page.evaluate(()=>bot.nudge())).toBe(true);
  await page.evaluate(()=>bot.remove());
  expect(await page.evaluate(()=>bot.nudge())).toBe(false);
  expect(await nudging(page)).toBe(false);
});
test('activation or turning the mode off cancels a running nudge',async({page})=>{
  await page.evaluate(()=>bot.nudge());
  await page.getByRole('button',{name:'Ajuda'}).click();
  expect(await nudging(page)).toBe(false);
  await expect.poll(()=>isHelp(page),{timeout:3000}).toBe(true);
  await page.evaluate(()=>{bot.nudge();bot.helpButton=false;});
  expect(await nudging(page)).toBe(false);
});
test('reduced motion shows a static ring instead of the pulse',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>bot.nudge());
  const ring=await page.evaluate(()=>{const s=getComputedStyle(bot.shadowRoot.querySelector('.help i'));return {name:s.animationName,opacity:Number(s.opacity)};});
  expect(ring.name).toBe('none');
  expect(ring.opacity).toBeGreaterThan(0);
});
test('help-button="false" keeps the mode off, like muted="false"',async({page})=>{
  await page.evaluate(()=>bot.setAttribute('help-button','false'));
  expect(await page.evaluate(()=>bot.helpButton)).toBe(false);
  expect(await isHelp(page)).toBe(false);
  await page.evaluate(()=>bot.setAttribute('help-button',''));
  expect(await page.evaluate(()=>bot.helpButton)).toBe(true);
});
test('activity during the delay restarts it instead of letting it expire',async({page})=>{
  await page.getByRole('button',{name:'Ajuda'}).click();
  // A task keeps the frame loop running past the 1500 ms delay.
  await page.evaluate(()=>{window.id=bot.beginTask();});
  await page.waitForTimeout(1800);
  await page.evaluate(()=>bot.endTask(id,{outcome:'cancelled'}));
  await page.waitForTimeout(900);
  expect(await isHelp(page)).toBe(false);
  await expect.poll(()=>isHelp(page),{timeout:3000}).toBe(true);
});
test('the "?" sits on a solid background with a halo and an outer ring in the button color',async({page})=>{
  const look=()=>page.evaluate(()=>{const s=getComputedStyle(bot.shadowRoot.querySelector('.help svg'));return {background:s.backgroundColor,shadow:s.boxShadow};});
  const plain=await look();
  expect(plain.background).toBe('rgb(255, 255, 255)');
  expect(plain.shadow).toBe('rgb(255, 255, 255) 0px 0px 0px 1px, rgb(56, 99, 75) 0px 0px 0px 3px');
  await page.evaluate(()=>bot.style.setProperty('--ddocbot-help-background','rgb(250, 240, 220)'));
  const custom=await look();
  expect(custom.background).toBe('rgb(250, 240, 220)');
  expect(custom.shadow).toBe('rgb(250, 240, 220) 0px 0px 0px 1px, rgb(56, 99, 75) 0px 0px 0px 3px');
});
