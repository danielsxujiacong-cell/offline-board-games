export function bindSpectrum(slider,update){
slider.classList.add('interactive-spectrum');slider.tabIndex=0;
for(const [name,value] of Object.entries({role:'slider','aria-label':'光谱猜测位置，可直接拖动','aria-valuemin':'0','aria-valuemax':'100','aria-orientation':'horizontal'}))slider.setAttribute(name,value);
let pointer=null;
const at=e=>{const rect=slider.getBoundingClientRect();if(rect.width>0)update((e.clientX-rect.left)/rect.width*100)};
slider.addEventListener('pointerdown',e=>{if(e.button!==0||e.isPrimary===false)return;e.preventDefault();pointer=e.pointerId;slider.setPointerCapture(pointer);slider.focus({preventScroll:true});at(e)});
slider.addEventListener('pointermove',e=>{if(e.pointerId===pointer)at(e)});
const stop=e=>{if(e.pointerId!==pointer)return;if(e.type==='pointerup')at(e);const id=pointer;pointer=null;if(slider.hasPointerCapture(id))slider.releasePointerCapture(id)};
slider.addEventListener('pointerup',stop);slider.addEventListener('pointercancel',stop);slider.addEventListener('lostpointercapture',()=>{pointer=null});
slider.addEventListener('keydown',e=>{const now=Number(slider.getAttribute('aria-valuenow'));const values={ArrowLeft:now-1,ArrowDown:now-1,ArrowRight:now+1,ArrowUp:now+1,PageDown:now-10,PageUp:now+10,Home:0,End:100};if(e.key in values){e.preventDefault();update(values[e.key])}});
}
