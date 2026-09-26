/* Matbakh — seasonal visual test layer v3 */
(function(){
  'use strict';
  const params=new URLSearchParams(location.search);
  const requested=params.get('season-test');
  const isTest=requested==='autumn'||requested==='halloween';
  if(!isTest) return;
  const rootClass='seasonal-test-'+requested;

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

  function installTheme(){
    document.body.dataset.seasonTest=requested;
    document.body.classList.add(rootClass);
    let link=document.getElementById('seasonalTestStyles');
    if(!link){
      link=document.createElement('link');
      link.id='seasonalTestStyles';
      link.rel='stylesheet';
      link.href='./seasonal-test.css?v=seasonal-test-v3';
      document.head.appendChild(link);
    }
  }

  function getHome(){return document.getElementById('home')||document.querySelector('[data-view="home"]');}
  function getOriginalMeals(home){
    if(!home) return [];
    const rows=[...home.querySelectorAll('.meal-slot')];
    return rows.slice(0,2).map((row,i)=>({
      icon:row.querySelector(':scope > span')?.textContent?.trim() || (i===0?'☀️':'🌙'),
      name:row.querySelector('button:not(.btn)')?.textContent?.trim() || row.textContent.replace(/\s+/g,' ').trim() || (i===0?'Déjeuner':'Dîner'),
      button:row.querySelector('button:not(.btn)')
    }));
  }
  function publicLabel(){return requested==='halloween'?'Halloween':'Automne'}

  function build(){
    const home=getHome();
    if(!home) return false;
    installTheme();
    const existing=document.getElementById('seasonalTestHome');
    const meals=getOriginalMeals(home);
    home.classList.add('seasonal-original-home');
    if(existing) existing.remove();

    const stage=document.createElement('section');
    stage.id='seasonalTestHome';
    stage.className='seasonal-test-home';
    stage.setAttribute('aria-label','Accueil Matbakh — test saisonnier');
    stage.innerHTML=`
      <header class="st-header">
        <div class="st-brand-wrap">
          <div class="st-brand">مَطْبَخ <span>♥</span></div>
          <div class="st-subtitle">Carnet de cuisine de la maison</div>
        </div>
        <div class="st-header-actions">
          <button class="st-icon" data-action="swap" aria-label="Changer de saison">↔</button>
          <button class="st-icon" data-action="theme" aria-label="Thème">${requested==='halloween'?'🎃':'🌿'}</button>
          <button class="st-icon" data-action="save" aria-label="Sauvegarder">▣</button>
        </div>
      </header>
      <main class="st-main">
        <section class="st-hero">
          <div class="st-hero-top"><span>VOTRE CUISINE, AU FIL DES SAISONS</span><b>${publicLabel()}</b></div>
          <div class="st-hero-brand">مَطْبَخ</div>
          <h1>Bonjour !</h1>
          <p>Prête à cuisiner aujourd'hui ?</p>
        </section>
        <section class="st-shortcuts">
          <button data-view="recipes"><span class="st-shortcut-icon">▤</span><strong>Mes recettes</strong></button>
          <button data-view="stock"><span class="st-shortcut-icon">▥</span><strong>Mon stock</strong></button>
          <button data-view="shopping"><span class="st-shortcut-icon">▦</span><strong>Ma liste de courses</strong></button>
          <button data-view="cakes"><span class="st-shortcut-icon">♨</span><strong>Mes gâteaux</strong></button>
        </section>
        <section class="st-today">
          <div class="st-today-head"><h2>Aujourd'hui</h2><span>${new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long'}).format(new Date())}</span></div>
          <div class="st-meals">
            ${meals.length?meals.map((m,i)=>`<button class="st-meal" data-original-meal="${i}"><span class="st-meal-icon">${esc(m.icon)}</span><span class="st-meal-copy"><strong>${esc(m.name)}</strong><small>🟢 Tout est disponible</small></span><span class="st-chevron">›</span></button>`).join(''):`<div class="st-empty">Aucun repas prévu aujourd'hui.</div>`}
          </div>
          <button class="st-program" data-action="program">Voir mon programme</button>
        </section>
      </main>
      <nav class="st-bottom-nav" aria-label="Navigation principale">
        <button class="active" data-action="home"><span>⌂</span><small>Accueil</small></button>
        <button data-view="meals"><span>♧</span><small>Repas</small></button>
        <button data-view="recipes"><span>▤</span><small>Recettes</small></button>
        <button data-view="stock"><span>▥</span><small>Stock</small></button>
        <button data-view="shopping"><span>⌑</span><small>Courses</small></button>
      </nav>`;
    home.parentNode.insertBefore(stage,home);

    stage.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>{
      const view=btn.dataset.view;
      if(typeof window.setView==='function') window.setView(view);
      else home.querySelector(`[data-view="${view}"]`)?.click();
    }));
    stage.querySelectorAll('[data-original-meal]').forEach(btn=>btn.addEventListener('click',()=>meals[Number(btn.dataset.originalMeal)]?.button?.click()));
    stage.querySelector('[data-action="program"]')?.addEventListener('click',()=>{if(typeof window.setView==='function') window.setView('meals');});
    stage.querySelector('[data-action="home"]')?.addEventListener('click',()=>{if(typeof window.setView==='function') window.setView('home');});
    return true;
  }

  function showSplash(){
    if(sessionStorage.getItem('matbakh-seasonal-splash-v3')) return;
    sessionStorage.setItem('matbakh-seasonal-splash-v3','1');
    const old=document.getElementById('seasonalTestSplash'); if(old) old.remove();
    const splash=document.createElement('div');
    splash.id='seasonalTestSplash'; splash.className='st-splash';
    splash.innerHTML=`<div class="st-splash-card"><div class="st-chef">♨</div><div class="st-splash-title">مَطْبَخ <span>♥</span></div><p>Votre cuisine,<br>au fil des saisons ♥</p><div class="st-progress"><i></i></div></div>`;
    document.body.appendChild(splash);
    setTimeout(()=>splash.classList.add('is-done'),1450);
    setTimeout(()=>splash.remove(),1850);
  }

  function boot(){
    installTheme();
    let tries=0;
    const tick=()=>{tries++;if(build()){showSplash();return}if(tries<60)setTimeout(tick,100)};
    tick();
    const observer=new MutationObserver(()=>{
      const home=getHome();
      const stage=document.getElementById('seasonalTestHome');
      if(home && !stage) build();
      if(home && home.classList.contains('active')){home.style.display='none';if(stage) stage.style.display='flex'}
      if(home && !home.classList.contains('active') && stage) stage.style.display='none';
    });
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
