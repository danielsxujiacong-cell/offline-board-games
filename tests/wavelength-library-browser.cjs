// Run against this checkout on localhost:8091; the temporary extra row is restored in finally.
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');const fs=require('node:fs');const assert=require('node:assert/strict');const file='wavelength/questions.json';const original=fs.readFileSync(file,'utf8');const total=JSON.parse(original).length;fs.mkdirSync('.openai',{recursive:true});
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});const c=await b.newContext({viewport:{width:390,height:844}});const p=await c.newPage();try{
await p.goto('http://127.0.0.1:8091/wavelength/');await p.evaluate(()=>navigator.serviceWorker.ready);await p.reload();await p.screenshot({path:'.openai/wavelength-library-home.png',fullPage:true});
const changed=JSON.parse(original);changed.push(['测试专用','缓存旧版本','在线新版本']);fs.writeFileSync(file,JSON.stringify(changed));
await p.reload();await p.getByText(`${total+1} 组聊天光谱`).waitFor();assert.equal(await p.locator('[name=pack][value="测试专用"]').count(),1);
await c.setOffline(true);await p.reload();await p.getByText(`${total+1} 组聊天光谱`).waitFor();console.log('PASS: modifying only questions.json updates the visible count/category online; updated library survives offline reload');
await c.setOffline(false);fs.writeFileSync(file,original);await p.reload();await p.getByText(`${total} 组聊天光谱`).waitFor();await p.locator('#setup .primary').click();await p.setViewportSize({width:320,height:740});await p.locator('#peek').dispatchEvent('pointerdown');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:'.openai/wavelength-library-game.png',fullPage:true});
}finally{fs.writeFileSync(file,original);await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});

