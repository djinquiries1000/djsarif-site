(() => {
  const link=document.getElementById('adminLink');
  const url=window.DJ_CONFIG?.adminUrl;
  if(/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url||'')){
    link.href=url+'?view=admin';link.hidden=false;
    document.getElementById('adminStatus').textContent='Open the secure dashboard and sign in with your authorized Google account.';
  }
})();
