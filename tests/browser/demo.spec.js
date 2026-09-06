import {test,expect} from '@playwright/test';
const firstFont=family=>family.split(',')[0].replace(/["']/g,'');
test('demo simulates work and exposes an inspectable pixel preview',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:'Pequeno ponto. Grande companhia.'})).toBeVisible();
 await page.getByRole('button',{name:'Iniciar processamento'}).click();
 await expect(page.locator('#live-state')).toHaveText('Processando');
 await page.getByRole('button',{name:'Concluir com sucesso'}).click();
 await expect.poll(()=>page.locator('dot-bot').evaluate(b=>b.state)).toBe('idle');
 await expect(page.locator('#pixel-preview')).toBeVisible();
});

test('demo renders with the readable DDOC color system and typography',async({page})=>{
 await page.goto('/');
 const appearance=await page.evaluate(()=>{
  const style=selector=>getComputedStyle(document.querySelector(selector));
  return {
   body:{background:style('body').backgroundColor,color:style('body').color,font:style('body').fontFamily},
   stage:{background:style('.stage-card').backgroundColor,border:style('.stage-card').borderTopColor},
   controls:{background:style('.controls-card').backgroundColor},
   accent:{background:style('.primary').backgroundColor,color:style('.primary').color},
   mono:style('.label').fontFamily,
   bot:style('dot-bot').color
  };
 });
 expect(appearance).toMatchObject({
  body:{background:'rgb(246, 245, 250)',color:'rgb(32, 32, 39)'},
  stage:{background:'rgb(36, 33, 44)',border:'rgb(69, 64, 79)'},
  controls:{background:'rgb(255, 255, 255)'},
  accent:{background:'rgb(109, 40, 217)',color:'rgb(255, 255, 255)'},
  bot:'rgb(0, 0, 0)'
 });
 expect(firstFont(appearance.body.font)).toBe('Inter');
 expect(firstFont(appearance.mono)).toBe('JetBrains Mono');
});

test('demo loads both font families locally without external requests',async({page})=>{
 const external=[];
 page.on('request',request=>{if(new URL(request.url()).origin!=='http://127.0.0.1:4173')external.push(request.url());});
 await page.goto('/');
 await page.evaluate(()=>document.fonts.ready);
 expect(external).toEqual([]);
 expect(await page.evaluate(()=>({inter:document.fonts.check('400 16px Inter'),mono:document.fonts.check('400 16px "JetBrains Mono"')}))).toEqual({inter:true,mono:true});
});

test('demo message bubble uses the DDOC theme at home and in the navigation portal',async({page})=>{
 await page.goto('/');
 const appearance=await page.locator('#ddocbot').evaluate(async bot=>{
  bot.say('Tema local',{duration:0});
  const read=bubble=>{const style=getComputedStyle(bubble);return {font:style.fontFamily,background:style.backgroundColor,color:style.color,border:style.borderTopColor,shadow:style.boxShadow};};
  const home=read(bot.shadowRoot.querySelector('.bubble'));
  await bot.flyTo('#guide-input',{duration:0});
  const portal=read(document.querySelector('[data-ddocbot-layer]').shadowRoot.querySelector('.bubble'));
  return {home,portal};
 });
 const themed={background:'rgb(255, 255, 255)',color:'rgb(32, 32, 39)',border:'rgb(150, 144, 164)',shadow:'none'};
 expect(appearance.home).toMatchObject(themed);
 expect(appearance.portal).toMatchObject(themed);
 expect(firstFont(appearance.home.font)).toBe('Inter');
 expect(firstFont(appearance.portal.font)).toBe('Inter');
});
