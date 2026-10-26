import {rating} from './prompts.js';
const font='system-ui, -apple-system, "Segoe UI", sans-serif';
function textLines(ctx,text,width){const lines=[];let line='';for(const ch of Array.from(String(text))){if(ch==='\n'){lines.push(line);line='';continue}if(line&&ctx.measureText(line+ch).width>width){lines.push(line);line=ch}else line+=ch}lines.push(line);return lines}
export async function createReportImage(state){
 await document.fonts?.ready;
 const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
 const width=800,pad=48,inner=width-pad*2;
 const setFont=(size,weight=400)=>{ctx.font=`${weight} ${size}px ${font}`};
 setFont(28,700);const names=textLines(ctx,state.names.join(' × '),inner);
 const rows=state.history.map((r,i)=>{setFont(20);const sender=textLines(ctx,`${String(i+1).padStart(2,'0')} / ${r.sender} 发射`,inner-90);setFont(23,600);const spectrum=textLines(ctx,`${r.left} ↔ ${r.right}`,inner-40);setFont(30,700);const clue=textLines(ctx,`「${r.clue}」`,inner-40);return {r,sender,spectrum,clue,height:146+sender.length*25+spectrum.length*30+clue.length*40}});
 const header=270+names.length*38;const height=header+rows.reduce((n,r)=>n+r.height+16,0)+100;
 canvas.width=width*2;canvas.height=height*2;ctx.scale(2,2);ctx.textBaseline='top';
 ctx.fillStyle='#132c2b';ctx.fillRect(0,0,width,height);
 const draw=(lines,x,y,size,color,weight=400,lineHeight=size*1.4)=>{setFont(size,weight);ctx.fillStyle=color;for(const line of lines){ctx.fillText(line,x,y);y+=lineHeight}return y};
 draw(['电波同步 / 双人默契战报'],pad,40,20,'#d7f77b',700);
 let y=draw(names,pad,84,28,'#f6f1df',700,38);
 const total=state.history.reduce((n,r)=>n+r.points,0);
 draw([`${total} / 24`],pad,y+14,64,'#d7f77b',800);draw([rating(total)],pad,y+92,28,'#f6f1df',700);
 draw([`得分率 ${Math.round(total/24*100)}% · ${state.history.length} 回合 · 仅供玩笑，不是关系测试`],pad,y+140,17,'#b1c6be');
 y=header;
 for(const row of rows){const {r}=row;ctx.fillStyle='#1c3835';ctx.fillRect(pad-16,y,inner+32,row.height);
  let yy=draw(row.sender,pad,y+20,20,'#b1c6be',400,25);
  draw([`+${r.points} 分`],width-pad-80,y+20,23,'#d7f77b',700);
  yy=draw(row.spectrum,pad,yy+12,23,'#f6f1df',600,30);
  yy=draw(row.clue,pad,yy+10,30,'#d7f77b',700,40);
  const barY=yy+14;ctx.fillStyle='#789e9a';ctx.fillRect(pad,barY,inner,12);
  ctx.fillStyle='#edce73';ctx.fillRect(pad+inner*(r.target-14)/100,barY,inner*28/100,12);
  ctx.fillStyle='#e86b5b';ctx.fillRect(pad+inner*(r.target-3)/100,barY,inner*6/100,12);
  ctx.fillStyle='#fff';ctx.fillRect(Math.min(width-pad-3,pad+inner*r.guess/100),barY-4,3,20);
  draw([`靶心 ${r.target}   /   猜测 ${r.guess}   /   误差 ${Math.abs(r.target-r.guess)}`],pad,barY+30,19,'#b1c6be');
  y+=row.height+16;
 }
 draw(['靶心色带 · 白线为猜测位置'],pad,y+12,16,'#b1c6be');draw(['games.danielxu.cn/wavelength/'],pad,y+43,18,'#d7f77b');
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG generation failed')),'image/png'));
 return {blob,width:canvas.width,height:canvas.height};
}
export function showReportImage(state){
 const snapshot=JSON.parse(JSON.stringify(state));const dialog=document.createElement('dialog');dialog.className='report-export';dialog.setAttribute('aria-label','保存战报图片');
 dialog.innerHTML='<div class="topline"><h2>保存这份脑回路</h2><button type="button" class="export-close" aria-label="关闭战报图片">关闭</button></div><p class="small export-status" role="status">正在生成完整战报图片…</p><div class="export-actions" hidden><a class="primary export-download" download="电波同步-战报.png">下载 PNG 图片</a><button type="button" class="export-share" hidden>分享图片</button></div><img class="export-image" alt="包含双方昵称、总分及全部六回合明细的电波同步战报" hidden>';
 document.body.append(dialog);dialog.showModal();let url;
 dialog.querySelector('.export-close').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{if(url)URL.revokeObjectURL(url);dialog.remove()},{once:true});
 createReportImage(snapshot).then(({blob})=>{if(!dialog.isConnected)return;url=URL.createObjectURL(blob);const img=dialog.querySelector('img');img.src=url;img.hidden=false;const link=dialog.querySelector('a');link.href=url;dialog.querySelector('.export-actions').hidden=false;dialog.querySelector('.export-status').textContent='点击下载保存图片；手机也可以长按下方图片保存。';
  if(typeof File!=='undefined'){const file=new File([blob],'电波同步-战报.png',{type:'image/png'});if(navigator.canShare?.({files:[file]})){const share=dialog.querySelector('.export-share');share.hidden=false;share.onclick=async()=>{try{await navigator.share({files:[file],title:'电波同步战报'})}catch(error){if(error.name!=='AbortError')dialog.querySelector('.export-status').textContent='分享未完成，可以下载或长按图片保存。'}}}}
 }).catch(()=>{if(dialog.isConnected)dialog.querySelector('.export-status').textContent='图片生成未完成，请关闭重试，或使用复制战报、打印功能。'});
}
