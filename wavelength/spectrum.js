export function bindSpectrum(slider,update,options={}){
  slider.classList.add('interactive-spectrum');
  slider.tabIndex=0;
  for(const [name,value] of Object.entries({
    role:'slider',
    'aria-label':'纯直觉电波条，可直接点击或左右拖动',
    'aria-valuemin':'0',
    'aria-valuemax':'100',
    'aria-orientation':'horizontal',
  }))slider.setAttribute(name,value);

  let pointer=null;
  const calc=e=>{
    const rect=slider.getBoundingClientRect();
    if(rect.width<=0)return null;
    return Math.max(0,Math.min(100,Math.round(((e.clientX-rect.left)/rect.width)*100)));
  };
  const apply=(e,emitMove=false)=>{
    const val=calc(e);
    if(val===null)return;
    update(val);
    if(emitMove)options.onMove?.(val);
  };

  slider.addEventListener('pointerdown',e=>{
    if(e.button!==0||e.isPrimary===false)return;
    e.preventDefault();
    pointer=e.pointerId;
    slider.classList.add('dragging');
    slider.setPointerCapture(pointer);
    slider.focus({preventScroll:true});
    apply(e,true);
  });
  slider.addEventListener('pointermove',e=>{
    if(e.pointerId===pointer)apply(e,true);
  });
  const stop=e=>{
    if(e.pointerId!==pointer)return;
    if(e.type==='pointerup')apply(e,true);
    const id=pointer;
    pointer=null;
    slider.classList.remove('dragging');
    if(slider.hasPointerCapture(id))slider.releasePointerCapture(id);
  };
  slider.addEventListener('pointerup',stop);
  slider.addEventListener('pointercancel',stop);
  slider.addEventListener('lostpointercapture',()=>{
    pointer=null;
    slider.classList.remove('dragging');
  });
  slider.addEventListener('keydown',e=>{
    const now=Number(slider.getAttribute('aria-valuenow')||50);
    const values={ArrowLeft:now-1,ArrowDown:now-1,ArrowRight:now+1,ArrowUp:now+1,PageDown:now-10,PageUp:now+10,Home:0,End:100};
    if(e.key in values){
      e.preventDefault();
      const next=Math.max(0,Math.min(100,values[e.key]));
      update(next);
      options.onMove?.(next);
    }
  });
}
