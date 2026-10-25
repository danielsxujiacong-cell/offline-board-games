const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),base=process.env.TEST_URL||'http://127.0.0.1:8080';
const sizes=[[320,568],[360,640],[390,844],[430,932],[568,320],[667,375],[844,390],[932,430]];
(async()=>{
 fs.mkdirSync(path.join(root,'.openai'),{recursive:true});
 const profile=fs.mkdtempSync(path.join(root,'.openai/jaipur-touch-'));
 const context=await chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,isMobile:true,hasTouch:true,viewport:{width:390,height:844}});
 try{
  await context.addInitScript(()=>{const n=new URL(location.href).searchParams.get('audit-rng');if(n!==null)Math.random=()=>Number(n);});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const tap=selector=>page.locator(selector).tap();
  const accept=async()=>{assert.equal(await page.locator('[data-area=hand]').count(),0);await tap('#accept');};
  const mode=m=>tap(`[data-mode="${m}"]`);
  const pick=(area,i)=>tap(`[data-area="${area}"][data-index="${i}"]`);
  const pickGood=()=>page.locator('[data-area=market]:not(.camel)').first().tap();
  const commit=async()=>{assert.ok(await page.locator('#commit').isEnabled(),await page.locator('#error').innerText());await tap('#commit');assert.equal(await page.locator('[data-area=hand]').count(),0);assert.equal(await page.locator('.private').count(),0);};
  const deal=async r=>{await page.goto(`${base}/jaipur/?audit-rng=${r}`);await accept();};
  await page.goto(base+'/jaipur/');
  for(const [width,height]of sizes){
   await page.setViewportSize({width,height});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const geometry=await page.evaluate(()=>{const d=document.querySelector('.handoff'),panel=d.firstElementChild.getBoundingClientRect(),b=document.querySelector('#accept'),r=b.getBoundingClientRect();return {modal:d.matches(':modal'),panel:{top:panel.top,bottom:panel.bottom},button:{top:r.top,bottom:r.bottom},hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b};});
   assert.ok(geometry.modal);assert.ok(geometry.panel.top>=0&&geometry.panel.bottom<=height,JSON.stringify({width,height,geometry}));assert.ok(geometry.hit);
   await page.keyboard.press('Escape');assert.ok(await page.locator('.handoff').isVisible());
   await page.locator('#rules').evaluate(b=>b.focus());assert.notEqual(await page.evaluate(()=>document.activeElement.id),'rules');
   if(width===568)await page.screenshot({path:path.join(root,'.openai/jaipur-audit-landscape-handoff.png')});
  }
  await page.setViewportSize({width:390,height:844});
  await deal(.999);await mode('exchange');await pick('market',3);await pick('market',4);await tap('#plus');
  assert.match(await page.locator('#error').innerText(),/数量必须相同/);assert.ok(await page.locator('#commit').isDisabled());
  await tap('#plus');await tap('#minus');assert.ok(await page.locator('#commit').isDisabled());await tap('#plus');
  // Two taps at the same coordinates must not acknowledge the next player's handoff.
  await page.locator('#commit').scrollIntoViewIfNeeded();const button=await page.locator('#commit').boundingBox();
  await page.touchscreen.tap(button.x+button.width/2,button.y+button.height/2);await page.touchscreen.tap(button.x+button.width/2,button.y+button.height/2);
  assert.ok(await page.locator('.handoff').isVisible());assert.equal(await page.locator('[data-area=hand]').count(),0);
  await accept();await mode('camels');await commit();await accept();assert.equal(await page.locator('[data-area=hand]').count(),2);
  await mode('exchange');await pick('market',0);await pick('market',1);await tap('#plus');await tap('#plus');await commit();
  await accept();await mode('sell');await pick('hand',0);await pick('hand',1);await commit();
  // Natural legal play reaches a seven-card hand without injecting application state.
  await accept();await mode('take');await pickGood();await commit();
  await accept();await mode('take');await pickGood();await commit();
  await accept();await mode('take');await pickGood();await commit();
  await accept();await mode('sell');await pick('hand',0);await commit();
  await accept();await mode('take');await pickGood();await commit();
  await accept();await mode('take');await pickGood();await commit();
  await accept();assert.equal(await page.locator('[data-area=hand]').count(),7);
  await mode('take');await pickGood();assert.match(await page.locator('#error').innerText(),/手牌已达 7 张/);assert.ok(await page.locator('#commit').isDisabled());
  for(const [width,height]of sizes){
   await page.setViewportSize({width,height});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await page.locator('[data-area=hand]').count(),7);assert.equal(await page.locator('[data-area=market]').count(),5);
   const small=await page.locator('button:visible').evaluateAll(bs=>bs.map(b=>({id:b.id,rect:b.getBoundingClientRect()})).filter(x=>x.rect.width<44||x.rect.height<44).map(x=>x.id));assert.deepEqual(small,[],`${width}x${height} touch targets`);
   for(const selector of ['[data-area=market][data-index="4"]','[data-area=hand][data-index="6"]','#commit']){
    await page.locator(selector).scrollIntoViewIfNeeded();
    assert.ok(await page.locator(selector).evaluate(b=>{const r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===b||b.contains(hit);}),`${width}x${height} obscured ${selector}`);
   }
   await mode('sell');await pick('hand',6);assert.equal(await page.locator('[data-area=hand][aria-pressed=true]').count(),1);await pick('hand',6);
   if(width===390)await page.screenshot({path:path.join(root,'.openai/jaipur-audit-seven-cards-portrait.png'),fullPage:true});
   if(width===844)await page.screenshot({path:path.join(root,'.openai/jaipur-audit-seven-cards-landscape.png'),fullPage:true});
  }
  const hand=await page.locator('[data-area=hand]').allTextContents();
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  assert.equal(await page.locator('[data-area=hand]').count(),0);await accept();assert.deepEqual(await page.locator('[data-area=hand]').allTextContents(),hand);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  assert.equal(await page.locator('[data-area=hand]').count(),0);await accept();assert.deepEqual(await page.locator('[data-area=hand]').allTextContents(),hand);
  page.once('dialog',d=>d.dismiss());await tap('#restart');assert.equal(await page.locator('[data-area=hand]').count(),7);
  await page.setViewportSize({width:390,height:844});await deal(0);await mode('sell');await pick('hand',0);assert.match(await page.locator('#error').innerText(),/贵重品至少出售 2 张/);assert.ok(await page.locator('#commit').isDisabled());
  await deal(.5);await mode('exchange');await pick('market',3);await pick('market',4);await pick('hand',1);await tap('#plus');assert.match(await page.locator('#error').innerText(),/交换商品颜色冲突/);assert.ok(await page.locator('#commit').isDisabled());
  await tap('#rules');assert.ok(await page.locator('#rulebook').isVisible());await tap('#close-rules');
  await page.goto(base+'/');await page.goBack();assert.equal(await page.locator('[data-area=hand]').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: actual touch input; 8 portrait/landscape sizes; modal focus/Escape; double tap; exchange +/-; color conflict; precious minimum; seven-card cap; all 7 cards/5 market cards unobscured; lifecycle privacy; cancel restart; rules; history.');
 }finally{await context.close();if(path.dirname(profile)===path.join(root,'.openai'))fs.rmSync(profile,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1)});
