import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
  await page.goto('/');
  await page.evaluate(async()=>{
    const {defineDdocBot}=await import('/src/index.js');defineDdocBot();
    document.body.innerHTML=`<style>body{margin:0;min-height:2400px}#target{position:absolute;left:160px;top:150px;width:140px;height:60px}#far{position:absolute;left:200px;top:1900px;width:150px;height:60px}</style><button id="target">Atenção aqui</button><input id="far" aria-label="Campo distante"><dot-bot></dot-bot>`;
    window.bot=document.querySelector('dot-bot');window.target=document.querySelector('#target');window.far=document.querySelector('#far');
  });
});
const portal=page=>page.locator('[data-ddocbot-layer]');

test('flies, points from its hand without blocking a button, then returns home',async({page})=>{
  expect(await page.evaluate(()=>typeof bot.flyTo)).toBe('function');
  await page.locator('#target').focus();
  expect(await page.evaluate(()=>bot.flyTo('#target',{duration:120}))).toBe('arrived');
  expect(await page.evaluate(()=>bot.navigationState)).toBe('hovering');
  await expect(portal(page)).toHaveCount(1);
  const box=await portal(page).locator('.trigger').boundingBox();const targetBox=await page.locator('#target').boundingBox();
  expect(box.x+box.width<=targetBox.x||box.x>=targetBox.x+targetBox.width||box.y+box.height<=targetBox.y||box.y>=targetBox.y+targetBox.height).toBe(true);
  expect(await page.evaluate(()=>bot.pointAt(target))).toBe(true);
  await expect(portal(page).locator('.laser')).toBeVisible();
  const beam=await portal(page).locator('line').evaluate(line=>Object.fromEntries(['x1','y1','x2','y2'].map(k=>[k,Number(line.getAttribute(k))])));
  expect(Object.values(beam).every(Number.isFinite)).toBe(true);
  expect(beam.x2).toBeGreaterThanOrEqual(targetBox.x);expect(beam.x2).toBeLessThanOrEqual(targetBox.x+targetBox.width);
  expect(beam.y2).toBeGreaterThanOrEqual(targetBox.y);expect(beam.y2).toBeLessThanOrEqual(targetBox.y+targetBox.height);
  const sprite=await portal(page).locator('canvas').boundingBox();
  expect(await portal(page).locator('canvas').evaluate((canvas,p)=>canvas.getContext('2d').getImageData(p.x,p.y,1,1).data[3],{x:beam.x1-sprite.x,y:beam.y1-sprite.y})).toBe(255);
  expect(await page.evaluate(()=>document.activeElement.id)).toBe('target');
  await page.evaluate(()=>{window.clicks=0;target.onclick=()=>clicks++;});await page.locator('#target').click();expect(await page.evaluate(()=>clicks)).toBe(1);
  await page.evaluate(()=>bot.say('Use este botão',{duration:0}));await expect(page.getByRole('status')).toHaveText('Use este botão');
  await page.evaluate(()=>bot.stopPointing());await expect(portal(page).locator('.laser')).toBeHidden();
  expect(await page.evaluate(()=>bot.returnHome({duration:120}))).toBe('arrived');
  expect(await page.evaluate(()=>bot.navigationState)).toBe('home');await expect(portal(page)).toHaveCount(0);
});

test('scrolls to a document target and laser tracks scroll without forcing it back',async({page})=>{
  expect(await page.evaluate(()=>bot.flyTo(far,{duration:80}))).toBe('arrived');
  expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(500);
  await page.evaluate(()=>bot.pointAt(far));await expect(portal(page).locator('.laser')).toBeVisible();
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  await expect(portal(page).locator('.laser')).toBeHidden();
  await page.waitForTimeout(200);expect(await page.evaluate(()=>scrollY)).toBe(0);
  await page.evaluate(()=>far.scrollIntoView({behavior:'instant',block:'center'}));
  await expect(portal(page).locator('.laser')).toBeVisible();
});

test('latest flight wins and loss of the target returns home',async({page})=>{
  await page.evaluate(()=>{window.events=[];bot.addEventListener('ddocbot-targetlost',e=>events.push(e.detail));window.first=bot.flyTo(target,{duration:1000});});
  await page.waitForTimeout(60);
  expect(await page.evaluate(()=>{window.second=bot.flyTo({x:500,y:200},{duration:80});return first;})).toBe('cancelled');
  expect(await page.evaluate(()=>second)).toBe('arrived');
  await page.evaluate(()=>bot.flyTo(target,{duration:0}));await page.evaluate(()=>bot.pointAt(target));
  await page.evaluate(()=>target.remove());
  await expect.poll(()=>page.evaluate(()=>bot.navigationState)).toBe('home');
  expect(await page.evaluate(()=>events.length)).toBe(1);
});

test('tasks stay independent and disconnect resolves commands and removes the portal',async({page})=>{
  await page.evaluate(()=>{window.task=bot.beginTask();});await page.evaluate(()=>bot.flyTo(target,{duration:0}));
  await expect.poll(()=>page.evaluate(()=>bot.state)).toBe('processing');
  await page.evaluate(()=>bot.pointAt(target));await page.evaluate(()=>bot.endTask(task,{outcome:'success'}));
  await expect.poll(()=>page.evaluate(()=>bot.state)).toBe('idle');
  expect(await page.evaluate(()=>bot.navigationState)).toBe('pointing');
  await page.evaluate(()=>{window.flight=bot.returnHome({duration:1000});bot.remove();});
  expect(await page.evaluate(()=>flight)).toBe('cancelled');await expect(portal(page)).toHaveCount(0);
  await page.evaluate(()=>document.body.append(bot));expect(await page.evaluate(()=>bot.navigationState)).toBe('home');
});

test('reduced motion is immediate, narrow placement and bubbles remain in viewport',async({page})=>{
  await page.setViewportSize({width:240,height:480});await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>{target.style.left='80px';target.style.top='4px';target.style.width='100px';});
  expect(await page.evaluate(()=>bot.flyTo(target,{duration:10000}))).toBe('arrived');
  await page.evaluate(()=>{bot.pointAt(target);bot.say('Uma explicação longa '.repeat(50),{duration:0});});
  const trigger=await portal(page).locator('.trigger').boundingBox();expect(trigger.x).toBeGreaterThanOrEqual(0);expect(trigger.x+44).toBeLessThanOrEqual(240);expect(trigger.y).toBeGreaterThanOrEqual(0);
  const bubble=await portal(page).locator('.bubble').boundingBox();expect(bubble.x).toBeGreaterThanOrEqual(0);expect(bubble.y).toBeGreaterThanOrEqual(0);expect(bubble.y+bubble.height).toBeLessThanOrEqual(480);
});

test('nested scrollers, shadow targets and removed/hidden targets are handled',async({page})=>{
  await page.evaluate(()=>{
    const host=document.createElement('div');host.style.cssText='position:absolute;top:200px;left:20px;width:300px;height:200px;overflow:auto;transform:translateX(0)';
    document.body.append(host);host.attachShadow({mode:'open'}).innerHTML='<div style="height:800px;padding-top:600px"><button id="nested">Nested</button></div>';
    window.nested=host.shadowRoot.querySelector('button');window.scroller=host;
  });
  expect(await page.evaluate(()=>bot.flyTo(nested,{duration:30}))).toBe('arrived');
  expect(await page.evaluate(()=>scroller.scrollTop)).toBeGreaterThan(0);
  await page.evaluate(()=>bot.pointAt(nested));await expect(portal(page).locator('.laser')).toBeVisible();
  await page.evaluate(()=>scroller.style.display='none');await expect.poll(()=>page.evaluate(()=>bot.navigationState)).toBe('home');
  expect(await page.evaluate(()=>bot.flyTo('#missing'))).toBe('target-unavailable');
});

test('pointing at a new target holds position and releases the old flight anchor',async({page})=>{
  await page.evaluate(()=>bot.flyTo(target,{duration:0}));
  await page.evaluate(()=>bot.pointAt({x:550,y:250}));
  const before=await portal(page).locator('canvas').boundingBox();
  await page.evaluate(()=>target.remove());await page.waitForTimeout(150);
  expect(await page.evaluate(()=>bot.navigationState)).toBe('pointing');
  const after=await portal(page).locator('canvas').boundingBox();expect(after).toEqual(before);
});

test('event listeners can replace navigation commands without crashes or overwritten flights',async({page})=>{
  const result=await page.evaluate(async()=>{
    bot.addEventListener('ddocbot-navigationchange',event=>{if(event.detail.state==='flying')void bot.returnHome({duration:0});},{once:true});
    return await bot.flyTo(target,{duration:100});
  });
  expect(result).toBe('cancelled');expect(await page.evaluate(()=>bot.navigationState)).toBe('home');
  await page.evaluate(()=>bot.flyTo(target,{duration:0}));
  await page.evaluate(()=>{bot.addEventListener('ddocbot-targetlost',()=>{window.replacement=bot.flyTo({x:600,y:220},{duration:0});},{once:true});target.remove();});
  await expect.poll(()=>page.evaluate(()=>window.replacement !== undefined)).toBe(true);
  expect(await page.evaluate(()=>replacement)).toBe('arrived');
  expect(await page.evaluate(()=>bot.navigationState)).toBe('hovering');
});

test('laser tracks a moving target and uses the configured color',async({page})=>{
  await page.evaluate(()=>bot.flyTo(target,{duration:0}));
  await page.evaluate(()=>{bot.style.setProperty('--ddocbot-laser-color','#123456');bot.pointAt(target);target.style.left='380px';target.style.top='240px';});
  await expect.poll(()=>portal(page).locator('line').getAttribute('x2')).not.toBe('300');
  await expect.poll(()=>portal(page).locator('line').evaluate(line=>{
    const target=document.querySelector('#target').getBoundingClientRect();const x=Number(line.getAttribute('x2')),y=Number(line.getAttribute('y2'));
    return x>=target.left&&x<=target.right&&y>=target.top&&y<=target.bottom;
  })).toBe(true);
  await expect(portal(page).locator('line')).toHaveCSS('stroke','rgb(18, 52, 86)');
  await page.setViewportSize({width:600,height:400});
  const actor=await portal(page).locator('.trigger').boundingBox();expect(actor.x+44).toBeLessThanOrEqual(600);expect(actor.y+44).toBeLessThanOrEqual(400);
});

test('portal escapes a clipped transformed parent and restores the original presentation',async({page})=>{
  await page.evaluate(()=>{
    const container=document.createElement('div');container.style.cssText='position:fixed;left:5px;top:5px;width:30px;height:30px;overflow:hidden;transform:translateZ(0)';document.body.append(container);container.append(bot);
  });
  expect(await page.evaluate(()=>bot.flyTo(target,{duration:40}))).toBe('arrived');
  await expect(portal(page).locator('canvas')).toBeVisible();
  const box=await portal(page).locator('canvas').boundingBox();expect(box.x).toBeGreaterThan(30);
  expect(await page.evaluate(()=>document.querySelector('[data-ddocbot-layer]').parentElement===document.body)).toBe(true);
  await page.evaluate(()=>bot.returnHome({duration:0}));
  await expect(portal(page)).toHaveCount(0);await expect(page.locator('dot-bot').locator('canvas')).toHaveCount(1);
});

test('visibility notifications pause a flight and resume it without counting hidden time',async({page})=>{
  await page.evaluate(()=>{window.flight=bot.flyTo(target,{duration:500});});
  await page.waitForTimeout(60);
  // Headless browser visibility is supplied at the browser boundary; app timers are real.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  const before=await portal(page).locator('canvas').boundingBox();await page.waitForTimeout(600);
  expect(await portal(page).locator('canvas').boundingBox()).toEqual(before);
  expect(await page.evaluate(()=>bot.navigationState)).toBe('flying');
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  expect(await page.evaluate(()=>flight)).toBe('arrived');
});
