const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base=process.env.TEST_URL||'http://127.0.0.1:8091';
  try{
    await page.goto(base+'/wavelength/');
    assert.equal(await page.locator('[name=pack][value="情侣日常"]').isChecked(),true);
    assert.equal(await page.locator('[name=pack][value="微醺暧昧"]').isChecked(),false);
    assert.equal(await page.locator('[name=pack]:checked').count(),5);
    assert.equal(await page.locator('.scale').count(),0);
    for(const width of [320,390,768,1280]){
      await page.setViewportSize({width,height:844});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    await page.setViewportSize({width:390,height:844});
    await page.locator('#b').fill('芝麻搭档');
    await page.locator('#a').fill('<小明>');
    await page.locator('#setup .primary').click();

    const peek=async()=>{
      assert.equal(await page.locator('.scale').count(),0);
      assert.equal(await page.locator('#secret-track .zone').count(),3);
      assert.equal(await page.locator('#secret-track .zone.four').isVisible(),false);
      await page.locator('#peek').click();
      assert.equal(await page.locator('#secret-track').evaluate(e=>e.classList.contains('hidden-target')),false);
      assert.equal(await page.locator('#secret-track .zone.four').isVisible(),true);
      await page.locator('#peek').click();
      assert.equal(await page.locator('#secret-track').evaluate(e=>e.classList.contains('hidden-target')),true);
      assert.equal(await page.locator('#secret-track .zone.four').isVisible(),false);
      await page.locator('#peek').click();
      assert.equal(await page.locator('#secret-track .zone.four').isVisible(),true);
    };

    let expected=0;
    const offsets=[0,8,14,15,9,8,10];
    const ptsList=[4,3,2,0,2,3,2];
    for(let i=0;i<7;i++){
      await peek();
      let state=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('wavelength-v1')));
      assert.equal(state.round,i);
      if(i===0){
        await page.locator('#hint-toggle').click();
        assert.equal(await page.locator('#hint-box').isVisible(),true);
        await page.locator('#oral').click();
      }else{
        await page.locator('#clue').fill('火锅');
        await page.locator('#clue-form .primary').click();
      }
      await page.locator('#receive').click();
      const spectrum=page.locator('.interactive-spectrum');
      const box=await spectrum.boundingBox();
      const g=Math.max(0,Math.min(100,state.target+offsets[i]));
      await page.mouse.click(box.x+box.width*(g/100),box.y+box.height/2);
      await page.locator('#lock').click();
      expected+=ptsList[i];
      await page.locator('#next').click();
    }
    assert.equal(await page.locator('.history article').count(),7);
    assert.ok((await page.locator('.score').innerText()).includes(String(expected)));
    assert.deepEqual(errors,[]);
    console.log('PASS: 210 short cards, default 5 packs + spicy off, pure intuition bar, oral clue, bonus +1 round, report');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
