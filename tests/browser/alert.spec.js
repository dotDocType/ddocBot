import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
  await page.goto('/');await page.evaluate(()=>{
    document.body.innerHTML='<button id="target" style="position:fixed;left:140px;top:160px">Alvo</button><dot-bot></dot-bot>';
    window.bot=document.querySelector('dot-bot');window.target=document.querySelector('#target');
  });
});
const waves=page=>page.locator('[data-ddocbot-layer]').locator('.alert-waves');
test('waves expand around the robot only while a visible laser is pointing',async({page})=>{
  await page.evaluate(()=>bot.flyTo(target,{duration:0}));await page.evaluate(()=>bot.pointAt(target));
  await expect(waves(page)).toBeVisible();
  const first=await waves(page).locator('circle').first().getAttribute('r');
  await expect.poll(()=>waves(page).locator('circle').first().getAttribute('r')).not.toBe(first);
  await page.evaluate(()=>bot.stopPointing());await expect(waves(page)).toBeHidden();
  await page.evaluate(()=>bot.pointAt(target));await expect(waves(page)).toBeVisible();
  await page.evaluate(()=>target.style.top='-100px');await expect(waves(page)).toBeHidden();
  await page.evaluate(()=>target.style.top='160px');await expect(waves(page)).toBeVisible();
  await page.evaluate(()=>bot.returnHome({duration:0}));await expect(waves(page)).toHaveCount(0);
});
test('reduced motion keeps static waves and custom color works',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>{bot.style.setProperty('--ddocbot-alert-color','#123456');bot.pointAt(target);});
  await expect(waves(page)).toBeVisible();
  const ring=waves(page).locator('circle').first();const radius=await ring.getAttribute('r');
  await page.waitForTimeout(250);expect(await ring.getAttribute('r')).toBe(radius);
  await expect(ring).toHaveCSS('stroke','rgb(18, 52, 86)');
});
test('optional alert beep repeats and stops with the laser',async({page})=>{
  expect(await page.evaluate(()=>bot.alertSound)).toBe(null);
  await page.evaluate(()=>{
    const button=document.createElement('button');button.textContent='Ativar alerta';button.onclick=async()=>{
      await bot.enableSound();window.beeps=0;
      // Count actual oscillator creation, preserving real Web Audio execution.
      const context=bot._audio.context,create=context.createOscillator.bind(context);
      context.createOscillator=()=>{window.beeps++;return create();};
      bot.alertSound='beep';bot.alertInterval=600;bot.pointAt(target);
    };document.body.append(button);
  });
  await page.getByText('Ativar alerta').click();await expect.poll(()=>page.evaluate(()=>window.beeps)).toBeGreaterThanOrEqual(2);
  await page.evaluate(()=>bot.stopPointing());const stopped=await page.evaluate(()=>beeps);
  await page.waitForTimeout(750);expect(await page.evaluate(()=>beeps)).toBe(stopped);
});
test('background alerts do not interrupt or stop foreground sounds',async({page})=>{
  await page.evaluate(()=>{
    const button=document.createElement('button');button.textContent='Testar prioridade';button.onclick=async()=>{
      await bot.enableSound();bot.alertSound='beep';
      await bot.playSound('success');
      const generation=bot._audio.generation;
      bot.pointAt(target);bot.stopPointing();
      window.uninterrupted=generation===bot._audio.generation && bot._audio.oscillators.size===3;
    };document.body.append(button);
  });
  await page.getByText('Testar prioridade').click();await expect.poll(()=>page.evaluate(()=>window.uninterrupted)).toBe(true);
});
test('hiding the page or disconnecting removes the alert and its animation',async({page})=>{
  await page.evaluate(()=>bot.pointAt(target));await expect(waves(page)).toBeVisible();
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(waves(page)).toBeHidden();
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await expect(waves(page)).toBeVisible();
  await page.evaluate(()=>bot.remove());await expect(waves(page)).toHaveCount(0);
  await page.evaluate(()=>document.body.append(bot));expect(await page.evaluate(()=>bot.navigationState)).toBe('home');
});
