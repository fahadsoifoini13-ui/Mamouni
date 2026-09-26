/* Matbakh — phase-1 seasonal presentation layer.
 *
 * This file is intentionally presentation-only.
 * - It never touches IndexedDB or application data.
 * - Autumn/Halloween test mode is activated only with ?season-test=autumn
 *   or ?season-test=halloween.
 * - Without the query parameter, the app keeps its normal visual behavior.
 */
(function(){
  const CHEF_ICON = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 37c-5-2-8-6-8-11 0-7 6-12 13-12 2-6 7-10 13-10s11 4 13 10c7 0 13 5 13 12 0 5-3 9-8 11v13H18V37Z" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"/><path d="M14 38h36M21 48h22" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>';

  const params = new URLSearchParams(window.location.search);
  const requested = params.get('season-test');
  const isTest = requested === 'autumn' || requested === 'halloween';

  function setPublicBrand(el, html, plain){
    if(!el) return;
    if(el.textContent.trim() !== plain) el.innerHTML = html;
  }

  function publicBrand(){
    setPublicBrand(document.querySelector('.brand'),'مَطْبَخ <span>♥</span>','مَطْبَخ ♥');
    setPublicBrand(document.querySelector('.home-wordmark'),'مَطْبَخ<span>♥</span>','مَطْبَخ♥');
    setPublicBrand(document.querySelector('.splash-title'),'مَطْبَخ<span>♥</span>','مَطْبَخ♥');

    const splash = document.getElementById('splash');
    if(splash) splash.setAttribute('aria-label','Ouverture de Matbakh');

    const mark = document.querySelector('.splash-mark');
    if(mark && !mark.querySelector('svg')) mark.innerHTML = CHEF_ICON;
  }

  function enhanceHome(){
    const home = document.getElementById('home');
    if(!home || !home.classList.contains('active')) return;
    publicBrand();

    const title = home.querySelector('.home-section-title');
    const grid = title?.nextElementSibling;
    if(!title || !grid || !grid.classList.contains('grid')) return;

    if(!home.querySelector('.home-program-cta')){
      const cta = document.createElement('button');
      cta.className = 'btn full home-program-cta';
      cta.type = 'button';
      cta.textContent = 'Voir mon programme';
      cta.addEventListener('click',()=>window.setView?.('meals'));
      grid.appendChild(cta);
    }
  }

  function loadTestStyles(){
    if(!isTest || document.getElementById('seasonalTestStyles')) return;
    const link = document.createElement('link');
    link.id = 'seasonalTestStyles';
    link.rel = 'stylesheet';
    link.href = 'seasonal-test.css?v=seasonal-test-r2';
    document.head.appendChild(link);
  }

  function forceRequestedTheme(){
    if(!isTest || typeof window.applySeason !== 'function') return false;
    if(requested === 'halloween') window.applySeason('autumn','halloween',false);
    else window.applySeason('autumn',null,false);
    window.render?.();
    document.body.dataset.seasonTest = requested;
    return true;
  }

  function boot(){
    loadTestStyles();
    publicBrand();
    enhanceHome();

    let tries = 0;
    const waitForApp = () => {
      tries += 1;
      publicBrand();
      if(isTest && forceRequestedTheme()) enhanceHome();
      if(tries < 40 && (!window.__matbakhBootFinished || (isTest && typeof window.applySeason !== 'function'))){
        window.setTimeout(waitForApp,100);
      }
    };
    waitForApp();

    const observer = new MutationObserver(()=>{
      publicBrand();
      enhanceHome();
    });
    const target = document.getElementById('app') || document.body;
    observer.observe(target,{subtree:true,childList:true});
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
