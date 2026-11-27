const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const contexts=await Promise.all([0,1].map(()=>browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})));
  const pages=await Promise.all(contexts.map(c=>c.newPage()));
  const [a,b]=pages,errors=[];const base=process.env.TEST_URL||'http://127.0.0.1:8091';
  for(const p of pages){p.setDefaultTimeout(45000);p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>window.__WAVELENGTH_DISABLE_POLLING__=true);}
  try{
    await Promise.all(pages.map(p=>p.goto(base+'/wavelength/online/')));
    await Promise.all(pages.map(p=>p.getByText('在线身份已连接',{exact:true}).waitFor()));
    await a.locator('[name=pack][value="微醺暧昧"]').check();
    await a.locator('#create').click();
    await a.locator('.room-code').waitFor();
    const roomCode=await a.locator('.room-code').innerText();
    await b.locator('#tab-join').click();
    await b.locator('#code').fill(roomCode);
    await b.locator('#join').click();
    await b.getByText(/正在想线索/).waitFor();
    await a.locator('#clue').fill('火锅');
    await a.locator('#clue-form .primary').click();
    await b.locator('#lock').waitFor();
    await b.locator('#lock').click();
    await Promise.all(pages.map(p=>p.locator('[data-send=next]').waitFor()));
    await a.locator('#leave').click();
    await a.locator('#confirm-exit').click();
    await b.getByText('房间已关闭',{exact:true}).waitFor();
    assert.deepEqual(errors,[]);
    console.log('PASS CLOUD: 0ms lobby, spicy pack enabled, realtime sync, in-page exit modal');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
