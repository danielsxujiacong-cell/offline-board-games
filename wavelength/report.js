import {rating} from './prompts.js';
const font='system-ui, -apple-system, "PingFang SC", "Segoe UI", sans-serif';

function textLines(ctx,text,width){
  const lines=[];let line='';
  for(const ch of Array.from(String(text))){
    if(ch==='\n'){lines.push(line);line='';continue}
    if(line&&ctx.measureText(line+ch).width>width){lines.push(line);line=ch}else line+=ch;
  }
  lines.push(line);return lines;
}

function roundRectPath(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.roundRect(x,y,w,h,r);
}

function formatDate(){
  const d=new Date();
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

export async function createReportImage(state){
  await document.fonts?.ready;
  const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Canvas unavailable');

  const width=800,pad=44,inner=width-pad*2;
  const setFont=(size,weight=400)=>{ctx.font=`${weight} ${size}px ${font}`};

  setFont(26,700);
  const names=textLines(ctx,state.names.join(' × '),inner-180);

  const rows=state.history.map((r,i)=>{
    setFont(18,500);
    const sender=textLines(ctx,`${String(i+1).padStart(2,'0')} / ${r.sender} 发射${r.bonus?' · +1续命':''}`,inner-120);
    setFont(27,800);
    const clue=textLines(ctx,`「${r.clue}」`,inner-48);
    setFont(20,650);
    const leftLines=textLines(ctx,r.left,inner*0.44);
    const rightLines=textLines(ctx,r.right,inner*0.44);
    const endLines=Math.max(leftLines.length,rightLines.length);
    return {r,sender,clue,leftLines,rightLines,height:118+sender.length*24+clue.length*36+endLines*26};
  });

  const heroH=236+names.length*36;
  const headerH=64+heroH+26;
  const height=headerH+rows.reduce((n,r)=>n+r.height+16,0)+106;

  canvas.width=width*2;canvas.height=height*2;
  ctx.scale(2,2);ctx.textBaseline='top';

  // Rich gradient background + subtle radial glow
  const bg=ctx.createLinearGradient(0,0,width,height);
  bg.addColorStop(0,'#102827');bg.addColorStop(0.55,'#163734');bg.addColorStop(1,'#0e2322');
  ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
  const glow=ctx.createRadialGradient(width*0.78,80,10,width*0.78,80,380);
  glow.addColorStop(0,'rgba(215,247,123,0.16)');glow.addColorStop(1,'rgba(215,247,123,0)');
  ctx.fillStyle=glow;ctx.fillRect(0,0,width,460);

  const draw=(lines,x,y,size,color,weight=400,lineHeight=size*1.38)=>{
    setFont(size,weight);ctx.fillStyle=color;
    for(const line of lines){ctx.fillText(line,x,y);y+=lineHeight}
    return y;
  };

  // Top brand header
  roundRectPath(ctx,pad,36,228,32,16);
  ctx.fillStyle='rgba(215,247,123,0.14)';ctx.fill();
  ctx.strokeStyle='rgba(215,247,123,0.45)';ctx.lineWidth=1.2;ctx.stroke();
  draw(['〰️ 电波同步 · 默契战报'],pad+14,43,15,'#d7f77b',700);
  setFont(15,500);ctx.fillStyle='#96b4ac';ctx.textAlign='right';
  ctx.fillText(formatDate(),width-pad,44);
  ctx.textAlign='left';

  // Hero summary card
  const cardTop=84;
  roundRectPath(ctx,pad,cardTop,inner,heroH-20,24);
  ctx.fillStyle='#193935';ctx.fill();
  ctx.strokeStyle='#3d5c55';ctx.lineWidth=1.5;ctx.stroke();

  const total=state.history.reduce((n,r)=>n+r.points,0);
  const maxScore=Math.max(4,state.history.length*4);
  const rate=Math.round(total/maxScore*100);
  const bonusCount=state.history.filter(r=>r.bonus).length;

  const ny=draw(names,pad+26,cardTop+24,26,'#f6f1df',750,36);
  draw([`${total} / ${maxScore}`],pad+26,ny+10,60,'#d7f77b',850,66);
  draw([rating(total,state.history.length)],pad+26,ny+84,26,'#f6f1df',750,32);
  draw([`共 ${state.history.length} 回合 · 同步率 ${rate}%${bonusCount?` · 续命 +${bonusCount}`:''}`],pad+26,ny+128,16,'#b1c6be',500);

  // Sync ring gauge on right of hero card
  const cx=width-pad-82,cy=cardTop+Math.max(98,(heroH-20)/2),rad=52;
  ctx.lineWidth=10;ctx.lineCap='round';
  ctx.beginPath();ctx.arc(cx,cy,rad,0,Math.PI*2);ctx.strokeStyle='#274b45';ctx.stroke();
  ctx.beginPath();ctx.arc(cx,cy,rad,-Math.PI/2,-Math.PI/2+(Math.PI*2*Math.min(1,total/maxScore)));ctx.strokeStyle='#d7f77b';ctx.stroke();
  setFont(22,800);ctx.fillStyle='#d7f77b';ctx.textAlign='center';
  ctx.fillText(`${rate}%`,cx,cy-16);
  setFont(12,600);ctx.fillStyle='#b1c6be';
  ctx.fillText('同步率',cx,cy+11);
  ctx.textAlign='left';

  // Round cards
  let ry=headerH;
  for(const row of rows){
    const {r}=row;
    roundRectPath(ctx,pad,ry,inner,row.height,18);
    ctx.fillStyle='#193935';ctx.fill();
    ctx.strokeStyle='#35524c';ctx.lineWidth=1.2;ctx.stroke();

    const yy=draw(row.sender,pad+22,ry+18,18,'#9ebbb3',500,24);

    // Score pill
    const pillColor=r.points===4?'#d7f77b':r.points===3?'#f3ae83':r.points===2?'#88c9be':'#6e8580';
    roundRectPath(ctx,width-pad-94,ry+14,72,30,15);
    ctx.fillStyle=r.points===4?'rgba(215,247,123,0.18)':'rgba(255,255,255,0.06)';ctx.fill();
    setFont(18,800);ctx.fillStyle=pillColor;ctx.textAlign='center';
    ctx.fillText(`+${r.points} 分`,width-pad-58,ry+19);
    ctx.textAlign='left';

    const cy2=draw(row.clue,pad+22,yy+6,27,'#d7f77b',800,36);

    // Left / right endpoints aligned above spectrum bar
    let eyLeft=cy2+4;
    setFont(19,650);ctx.fillStyle='#f6f1df';
    for(const l of row.leftLines){ctx.fillText(l,pad+22,eyLeft);eyLeft+=24}
    let eyRight=cy2+4;
    ctx.textAlign='right';
    for(const l of row.rightLines){ctx.fillText(l,width-pad-22,eyRight);eyRight+=24}
    ctx.textAlign='left';

    const barX=pad+22,barW=inner-44,barY=Math.max(eyLeft,eyRight)+8,barH=22;
    ctx.save();
    roundRectPath(ctx,barX,barY,barW,barH,11);
    ctx.clip();
    const grad=ctx.createLinearGradient(barX,0,barX+barW,0);
    grad.addColorStop(0,'#5f93a3');grad.addColorStop(0.5,'#bfb79d');grad.addColorStop(1,'#e19972');
    ctx.fillStyle=grad;ctx.fillRect(barX,barY,barW,barH);
    ctx.fillStyle='#edce73';ctx.fillRect(barX+barW*(r.target-14)/100,barY,barW*28/100,barH);
    ctx.fillStyle='#f1a46a';ctx.fillRect(barX+barW*(r.target-8)/100,barY,barW*16/100,barH);
    ctx.fillStyle='#e86b5b';ctx.fillRect(barX+barW*(r.target-3)/100,barY,barW*6/100,barH);
    ctx.fillStyle='#ffffff';ctx.fillRect(barX+barW*r.target/100-1,barY,2,barH);
    ctx.restore();

    // Guess needle with lime dot handles
    const gx=Math.max(barX+4,Math.min(barX+barW-4,barX+barW*r.guess/100));
    ctx.fillStyle='#132c2b';ctx.fillRect(gx-3,barY-3,6,barH+6);
    ctx.fillStyle='#ffffff';ctx.fillRect(gx-1.5,barY-2,3,barH+4);
    ctx.beginPath();ctx.arc(gx,barY+2,5,0,Math.PI*2);ctx.fillStyle='#d7f77b';ctx.fill();
    ctx.beginPath();ctx.arc(gx,barY+barH-2,5,0,Math.PI*2);ctx.fillStyle='#d7f77b';ctx.fill();

    ry+=row.height+16;
  }

  // Footer
  draw(['纯直觉调频 · 猜的不是标准答案，是对方脑子里的刻度'],pad,ry+12,15,'#9ebbb3',500);
  draw(['https://games.danielxu.cn/wavelength/'],pad,ry+40,17,'#d7f77b',700);

  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG generation failed')),'image/png'));
  let dataUrl=canvas.toDataURL('image/png');
  if(dataUrl.length>900000)dataUrl=canvas.toDataURL('image/jpeg',0.88);
  return {blob,dataUrl,width:canvas.width,height:canvas.height};
}

export function showReportImage(state){
  const snapshot=JSON.parse(JSON.stringify(state));
  const isWeChat=/micromessenger/i.test(navigator.userAgent);
  const total=snapshot.history.reduce((n,r)=>n+r.points,0);
  const maxScore=Math.max(4,snapshot.history.length*4);
  const summaryText=`电波同步｜${snapshot.names.join(' × ')} ${total}/${maxScore}分（${rating(total,snapshot.history.length)}）\nhttps://games.danielxu.cn/wavelength/`;

  const dialog=document.createElement('dialog');
  dialog.className='report-export';
  dialog.setAttribute('aria-label','保存战报图片');
  dialog.innerHTML=`<div class="topline"><h2>战报海报</h2><button type="button" class="export-close" aria-label="关闭战报图片">关闭</button></div><p class="small export-status" role="status">正在生成高清战报海报…</p><div class="wx-poster-tip" ${isWeChat?'':'hidden'}>💬 <strong>微信分享：</strong>直接<strong>长按下方海报</strong>即可「发送给朋友」或「保存图片」</div><div class="export-actions" hidden><button type="button" class="primary wx-btn export-share" hidden>💬 一键微信分享海报</button><a class="primary export-download" download="电波同步-战报.png">下载 PNG 图片</a><button type="button" class="export-copy">📋 复制战报文案</button></div><img class="export-image" alt="包含双方昵称、总分及全部回合明细的电波同步战报" hidden>`;
  document.body.append(dialog);
  dialog.showModal();

  let blobUrl;
  dialog.querySelector('.export-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{if(blobUrl)URL.revokeObjectURL(blobUrl);dialog.remove()},{once:true});

  const copySummary=async()=>{
    let ok=false;
    if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(summaryText);ok=true}catch{}}
    if(!ok){
      const ta=document.createElement('textarea');ta.value=summaryText;ta.setAttribute('readonly','');
      ta.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';document.body.append(ta);ta.focus();ta.select();
      try{ok=document.execCommand('copy')}catch{}
      ta.remove();
    }
    dialog.querySelector('.export-status').textContent=ok?'✅ 战报文案已复制，去微信粘贴即可。':'请长按下方海报直接发送或保存。';
  };
  dialog.querySelector('.export-copy').onclick=copySummary;

  createReportImage(snapshot).then(({blob,dataUrl})=>{
    if(!dialog.isConnected)return;
    blobUrl=URL.createObjectURL(blob);
    const img=dialog.querySelector('img');
    img.src=dataUrl||blobUrl;
    img.hidden=false;

    const link=dialog.querySelector('a');
    link.href=blobUrl;
    dialog.querySelector('.export-actions').hidden=false;

    const statusEl=dialog.querySelector('.export-status');
    statusEl.textContent=isWeChat?'长按下方海报直接「发送给朋友」或「保存图片」。':'手机可直接长按海报保存/发微信，或点下方按钮分享。';

    if(!isWeChat&&typeof File!=='undefined'){
      const file=new File([blob],'电波同步-战报.png',{type:'image/png'});
      if(navigator.canShare?.({files:[file]})){
        const share=dialog.querySelector('.export-share');
        share.hidden=false;
        link.classList.remove('primary');
        share.onclick=async()=>{
          try{await navigator.share({files:[file],title:'电波同步 · 双人默契战报',text:summaryText})}
          catch(error){if(error.name!=='AbortError')statusEl.textContent='系统分享未完成，请下载或长按下方海报发微信。'}
        };
      }
    }
  }).catch(()=>{
    if(dialog.isConnected)dialog.querySelector('.export-status').textContent='图片生成未完成，请关闭重试，或使用复制战报、打印功能。';
  });
}
