(() => {
  const link = document.createElement('a');
  link.href = '../../';
  link.textContent = '← 返回游戏大厅';
  Object.assign(link.style, { position:'fixed', top:'max(10px, env(safe-area-inset-top))', left:'12px', zIndex:'9999', padding:'7px 10px', borderRadius:'999px', background:'rgba(0,0,0,.68)', color:'#fff', font:'600 13px system-ui,sans-serif', textDecoration:'none' });
  document.body.append(link);
})();
