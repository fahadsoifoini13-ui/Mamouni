const APP_VERSION="v6-seasonal-identity-r1";
const DB_NAME="mamouni-v1", DB_VERSION=3;
const STORE_NAMES=["recipes","stock","meals","shopping","cakes"];
const DB_STORE_NAMES=[...STORE_NAMES,"meta"];
let db, state={recipes:[],stock:[],meals:[],shopping:[],cakes:[]}, currentView="home", recipeFilter="all";
let appSettings={id:"app-settings",season:"auto",specialEvent:null,unitWeights:null},hasImportRollback=false;

function openDB(){return new Promise((res,rej)=>{
  let settled=false;
  let timer=null;
  const finish=(fn,v)=>{if(settled)return;settled=true;if(timer)clearTimeout(timer);fn(v)};
  if(!window.indexedDB){return finish(rej,new Error("IndexedDB n’est pas disponible dans ce navigateur ou ce mode de navigation."))}
  let r;
  try{r=indexedDB.open(DB_NAME,DB_VERSION)}catch(e){return finish(rej,e)}
  timer=setTimeout(()=>finish(rej,new Error("La base locale met trop de temps à s'ouvrir. Fermez les autres onglets Matbakh puis rechargez la page.")),3500);
  r.onupgradeneeded=()=>{
    const upgrading=r.result;
    for(const name of DB_STORE_NAMES)if(!upgrading.objectStoreNames.contains(name))upgrading.createObjectStore(name,{keyPath:"id"});
  };
  r.onsuccess=()=>{
    const opened=r.result;
    opened.onversionchange=()=>opened.close();
    if(settled){opened.close();return}
    db=opened;finish(res,db);
  };
  r.onerror=()=>finish(rej,r.error||new Error("Impossible d'ouvrir la base locale."));
  r.onblocked=()=>finish(rej,new Error("La base locale est utilisée par une autre fenêtre. Fermez les autres onglets de Matbakh puis rechargez."));
})}
function runTransaction(storeNames,mode,schedule){
  return new Promise((resolve,reject)=>{
    let transaction;
    let result;
    try{transaction=db.transaction(storeNames,mode)}catch(error){reject(error);return}
    transaction.oncomplete=()=>resolve(result);
    transaction.onerror=()=>reject(transaction.error||new Error("La transaction IndexedDB a échoué."));
    transaction.onabort=()=>reject(transaction.error||new Error("La transaction IndexedDB a été annulée."));
    try{result=schedule(transaction)}catch(error){try{transaction.abort()}catch{};reject(error)}
  });
}
function getAll(store){return runTransaction([store],"readonly",transaction=>{
  const request=transaction.objectStore(store).getAll();
  return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
})}
function getOne(store,id){return runTransaction([store],"readonly",transaction=>{
  const request=transaction.objectStore(store).get(id);
  return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
})}
function markRollbackDirty(transaction){
  const meta=transaction.objectStore("meta"),request=meta.get("last-import-rollback");
  request.onsuccess=()=>{if(request.result?.snapshot&&!request.result.dirty){request.result.dirty=true;meta.put(request.result)}};
}
function put(store,obj){
  const stores=store==="meta"?["meta"]:[store,"meta"];
  return runTransaction(stores,"readwrite",transaction=>{
    const request=transaction.objectStore(store).put(obj);
    if(obj.id!=="last-import-rollback")markRollbackDirty(transaction);
    return request;
  }).then(()=>{if(store!=="meta"||obj.id!=="last-import-rollback")hasImportRollback=false});
}
function del(store,id){
  const stores=store==="meta"?["meta"]:[store,"meta"];
  return runTransaction(stores,"readwrite",transaction=>{
    const request=transaction.objectStore(store).delete(id);
    if(id!=="last-import-rollback")markRollbackDirty(transaction);
    return request;
  }).then(()=>{if(store!=="meta")hasImportRollback=false});
}
function readDataSnapshot(){
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(DB_STORE_NAMES,"readonly");
    const snapshot={stores:{},settings:null,rollback:null};
    for(const name of STORE_NAMES){
      const request=transaction.objectStore(name).getAll();
      request.onsuccess=()=>{snapshot.stores[name]=request.result};
    }
    const meta=transaction.objectStore("meta");
    const settingsRequest=meta.get("app-settings"),rollbackRequest=meta.get("last-import-rollback");
    settingsRequest.onsuccess=()=>{snapshot.settings=settingsRequest.result||null};
    rollbackRequest.onsuccess=()=>{snapshot.rollback=rollbackRequest.result||null};
    transaction.oncomplete=()=>resolve(snapshot);
    transaction.onerror=()=>reject(transaction.error||new Error("Lecture de la sauvegarde locale impossible."));
    transaction.onabort=()=>reject(transaction.error||new Error("Lecture de la sauvegarde locale annulée."));
  });
}
async function loadAppSettings(){
  let saved=await getOne("meta","app-settings");
  if(!saved){
    let legacyWeights=null,legacySeason=null;
    try{legacyWeights=localStorage.getItem("matbakh-unit-weights");legacySeason=localStorage.getItem("matbakh-season")}catch{}
    saved={id:"app-settings",season:legacySeason||"auto",specialEvent:null,unitWeights:legacyWeights};
    await put("meta",saved);
  }
  appSettings={id:"app-settings",season:saved.season||"auto",specialEvent:saved.specialEvent||null,unitWeights:saved.unitWeights||null};
  UNIT_WEIGHT_G={"Pommes de terre":150};
  try{const weights=JSON.parse(appSettings.unitWeights||"{}");if(Number(weights.potato)>0)UNIT_WEIGHT_G["Pommes de terre"]=Number(weights.potato)}catch{}
  applySeason(appSettings.season,appSettings.specialEvent,false);
}
async function loadData(){
  const snapshot=await readDataSnapshot();
  state=snapshot.stores;
  hasImportRollback=!!snapshot.rollback?.snapshot&&!snapshot.rollback.dirty&&!snapshot.rollback.used;
  return snapshot;
}
function normalize(s){return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim()}
function inlineArg(value){return esc(JSON.stringify(String(value)))}

let UNIT_WEIGHT_G = {"Pommes de terre":150};
const SEASON_DECORATIONS={
  spring:[["branch","top-left"],["blossom","top-right"],["sprig","middle-left"],["petal","right-bottom"]],
  summer:[["sun","top-right"],["lemon","top-left"],["herb","left-bottom"],["orange","right-bottom"]],
  autumn:[["branch","top-left"],["pumpkin","top-right"],["mushroom","left-bottom"],["chestnut","middle-left"],["candle","right-bottom"]],
  winter:[["fir","top-left"],["snowflake","top-right"],["cinnamon","left-bottom"],["candle","right-bottom"],["sparkle","middle-right"]]
};
const HALLOWEEN_DECORATIONS=[["moon","top-right"],["pumpkin","top-left"],["bat","middle-left"],["candle","left-bottom"],["ghost","right-bottom"],["sparkle","middle-right"]];
function renderSeasonalDecor(){
  const layer=document.getElementById("seasonalDecor");
  if(!layer)return;
  const season=document.body.dataset.season||"autumn",event=document.body.dataset.specialEvent||"";
  const decorations=event==="halloween"?HALLOWEEN_DECORATIONS:(SEASON_DECORATIONS[season]||SEASON_DECORATIONS.autumn);
  layer.innerHTML=decorations.map(([symbol,position],index)=>`<svg class="season-art season-art--${position} season-art--${symbol} season-art--item-${index+1}" viewBox="0 0 100 100" focusable="false" aria-hidden="true"><use href="#season-${symbol}"></use></svg>`).join("");
}
function applySeason(theme,specialEvent=null,persist=true){
  const seasonNames=["spring","summer","autumn","winter","auto"];
  let selected=seasonNames.includes(theme)?theme:"auto";
  const event=specialEvent==="halloween"?"halloween":null;
  if(event)selected="autumn";
  const effective=selected==="auto"?autoSeason():selected;
  document.body.dataset.season=effective;
  if(event)document.body.dataset.specialEvent=event;else delete document.body.dataset.specialEvent;
  appSettings={...appSettings,id:"app-settings",season:selected,specialEvent:event};
  document.body.classList.remove("season-shift");
  void document.body.offsetWidth;
  document.body.classList.add("season-shift");
  window.setTimeout(()=>document.body.classList.remove("season-shift"),900);
  renderSeasonalDecor();
  if(persist&&db)put("meta",appSettings).catch(()=>showToast("Le thème n’a pas pu être mémorisé sur cet appareil."));
}
const ALIASES = {
  "oignons":"Oignon", "oignon":"Oignon",
  "oeuf":"Œufs", "oeufs":"Œufs", "œuf":"Œufs", "œufs":"Œufs",
  "pdt":"Pommes de terre", "pdts":"Pommes de terre", "pomme de terre":"Pommes de terre", "pommes de terre":"Pommes de terre", "patate":"Pommes de terre", "patates":"Pommes de terre",
  "tomate":"Tomates", "tomates":"Tomates",
  "carotte":"Carottes", "carottes":"Carottes",
  "pomme":"Pommes", "pommes":"Pommes",
  "courgette":"Courgettes", "courgettes":"Courgettes",
  "concombre":"Concombre", "concombres":"Concombre",
  "citron":"Citrons", "citrons":"Citrons",
  "banane":"Bananes", "bananes":"Bananes",
  "poire":"Poires", "poires":"Poires",
  "orange":"Oranges", "oranges":"Oranges"
};
function findStock(name){
  const target=normalize(canonicalIngredient(name));
  return state.stock.find(s=>normalize(canonicalIngredient(s.name))===target);
}

function stockCategory(name){
  const n=normalize(canonicalIngredient(name));
  if(["tomate","tomates","pomme","pommes","poire","poires","banane","bananes","orange","oranges","citron","citrons","concombre","concombres","courgette","courgettes","carotte","carottes","pomme de terre","pommes de terre","oignon","oignons","poireau","poireaux","champignon","champignons","chou","salade","ail"].includes(n)) return {category:"Fruits & légumes",subcategory:""};
  if(["sucre","farine","chocolat","cacao","vanille","levure","biscuits","miel","confiture"].includes(n)) return {category:"Secs",subcategory:"Sucré"};
  if(["cannelle","muscade","paprika","curcuma","gingembre","cumin","cardamome","safran","origan","thym","romarin","basilic","herbes de provence","piment","poivre","curry","quatre epices","4 epices","epices"].includes(n) || n.includes("epice")) return {category:"Secs",subcategory:"Épices"};
  if(["riz","pates","spaghetti","lentilles","semoule","couscous","sel","parmesan","huile","vinaigre"].includes(n)) return {category:"Secs",subcategory:"Salé"};
  if(["conserve","conserves","mais","haricots","tomates en boite","thon"].includes(n)) return {category:"Conserves",subcategory:""};
  if(["lait","creme","oeufs","fromage","fromage rape","beurre","yaourt","mozzarella","pate brisee"].includes(n)) return {category:"Frais",subcategory:""};
  if(["poulet","viande hachee","boeuf","porc","lardons","poisson","saumon"].includes(n)) return {category:"Boucherie",subcategory:""};
  if(["surgeles","frites","legumes surgeles","poisson surgeles"].includes(n)) return {category:"Surgeles",subcategory:""};
  return {category:"Autres",subcategory:""};
}

function canonicalIngredient(name){
  const n=normalize(name).replace(/\s+/g," ");
  return ALIASES[n] || String(name).trim();
}
function unitBase(name,q,u){
  const value=Number(q)||0;
  if(u==="kg") return {q:value*1000,unit:"g"};
  if(u==="g") return {q:value,unit:"g"};
  if(u==="L") return {q:value*1000,unit:"ml"};
  if(u==="cl") return {q:value*10,unit:"ml"};
  if(u==="ml") return {q:value,unit:"ml"};
  return {q:value,unit:"unit"};
}
function quantityFor(name,q,u){
  const n=canonicalIngredient(name), value=Number(q)||0;
  if(u==="unit" && UNIT_WEIGHT_G[n]) return {q:value*UNIT_WEIGHT_G[n],unit:"g",sourceUnit:"unit"};
  return unitBase(n,value,u);
}
function fmt(q,u){
  if(u==="g") return `${trim(q)} g`;
  if(u==="ml") return `${trim(q)} ml`;
  return `${trim(q)} unité${q>1?"s":""}`;
}
function trim(n){return Number(Number(n).toFixed(3)).toString()}
function availability(recipe){
 let missing=[],available=0;
 for(const [name,q,u] of recipe.ingredients){
   const need=quantityFor(name,q,u),s=findStock(name),have=s?unitBase(name,s.qty,s.unit).q:0;
   if(have+1e-9>=need.q)available++;
   else missing.push({name:canonicalIngredient(name),need:q,have,unit:need.unit,sourceUnit:u,shortage:need.q-have,baseUnit:need.unit});
 }
 return {available,total:recipe.ingredients.length,missing,ok:missing.length===0,pct:recipe.ingredients.length?Math.round(available/recipe.ingredients.length*100):100};
}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function monthKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function dateLabel(ds){return new Date(ds+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})}
function recipeById(id){return state.recipes.find(r=>r.id===id)}

function amountInBase(name,quantity,unit,weights=UNIT_WEIGHT_G){
 const canonical=canonicalIngredient(name),value=Number(quantity)||0;
 if(unit==="unit"&&weights[canonical])return {q:value*weights[canonical],unit:"g"};
 return unitBase(canonical,value,unit);
}
function calculateFoodShopping(data,today=dateKey(new Date()),weights=UNIT_WEIGHT_G){
 const need=new Map(),recipes=new Map(data.recipes.map(recipe=>[recipe.id,recipe]));
 const addIngredients=ingredients=>{
   for(const [name,quantity,unit] of ingredients||[]){
     const canonical=canonicalIngredient(name),amount=amountInBase(canonical,quantity,unit,weights),key=normalize(canonical);
     if(!need.has(key))need.set(key,{name:canonical,qty:0,unit:amount.unit,category:stockCategory(canonical).category});
     const item=need.get(key);
     if(item.unit===amount.unit)item.qty+=amount.q;
   }
 };
 for(const meal of data.meals)if(meal.status==="planned"&&meal.date>=today){const recipe=recipes.get(meal.recipeId);if(recipe)addIngredients(recipe.ingredients)}
 for(const cake of data.cakes)if(cake.status==="planned")addIngredients(cake.ingredients);
 const stockByName=new Map();
 for(const item of data.stock){const key=normalize(canonicalIngredient(item.name));if(!stockByName.has(key))stockByName.set(key,item)}
 const rows=[];
 for(const [key,item] of need){
   const stocked=stockByName.get(key),stockAmount=stocked?amountInBase(stocked.name,stocked.qty,stocked.unit,weights):{q:0,unit:item.unit};
   const shortage=Math.max(0,item.qty-(stockAmount.unit===item.unit?stockAmount.q:0));
   if(shortage>1e-9)rows.push({id:"c"+encodeURIComponent(key),name:item.name,qty:shortage,unit:item.unit,checked:false,type:"food",category:item.category});
 }
 return rows;
}
async function rebuildShopping(){
 const calculated=calculateFoodShopping(state),transaction=db.transaction(["shopping","meta"],"readwrite"),store=transaction.objectStore("shopping");
  let rows=[];
  await new Promise((resolve,reject)=>{
   transaction.oncomplete=resolve;
   transaction.onerror=()=>reject(transaction.error||new Error("Mise à jour des courses impossible."));
   transaction.onabort=()=>reject(transaction.error||new Error("Mise à jour des courses annulée."));
   const request=store.getAll();
   request.onsuccess=()=>{
     const existing=request.result,other=existing.filter(item=>item.type==="other");
     try{
       markRollbackDirty(transaction);
       for(const item of existing)if(item.type!=="other")store.delete(item.id);
       for(const item of calculated)store.put(item);
       rows=[...other,...calculated];
     }catch(error){try{transaction.abort()}catch{};reject(error)}
   };
   request.onerror=()=>reject(request.error||new Error("Lecture des courses impossible."));
 });
 state.shopping=rows;
 hasImportRollback=false;
 return rows;
}
async function addMissing(items){
 const list=Array.isArray(items)?items:[];
 if(!list.length)return;
 const existing=await getAll("shopping");
 for(const x of list){
  const name=canonicalIngredient(x.name),id="c"+encodeURIComponent(normalize(name)),found=existing.find(s=>s.id===id);
  if(found){found.qty=Math.max(found.qty,x.shortage||0);found.checked=false;await put("shopping",found)}
  else await put("shopping",{id,name,qty:x.shortage||0,unit:x.baseUnit||x.unit,checked:false,type:"food",category:stockCategory(name).category});
 }
 state.shopping=await getAll("shopping");
 render();showToast("✓ Les ingrédients manquants ont été ajoutés aux courses");
}

async function cookMeal(meal,force=false){
 const r=recipeById(meal.recipeId);if(!r)return;
 if(meal.status==="done"){await undoCookMeal(meal);return}
 const a=availability(r);
 if(!a.ok && !force){showMissingModal(meal,r,a);return}
 if(!a.ok && force){
   const names=a.missing.map(x=>`${x.name} (${fmt(x.shortage,x.unit)} manquant)`).join("\n• ");
   if(!confirm(`Certains ingrédients manquent pour « ${r.name} » :\n\n• ${names}\n\nLe repas sera quand même marqué comme réalisé. Seules les quantités réellement présentes en stock seront déduites. Continuer ?`))return;
 }
 for(const [name,q,u] of r.ingredients){const st=findStock(name),need=quantityFor(name,q,u);if(st){const have=unitBase(name,st.qty,st.unit).q;st.qty=Math.max(0,have-need.q);await put("stock",st)}}
 meal.status="done";meal.doneAt=new Date().toISOString();await put("meals",meal);
 state.stock=await getAll("stock");state.meals=await getAll("meals");await rebuildShopping();render();showToast(a.ok?"✓ Repas enregistré — stock mis à jour":"✓ Repas enregistré malgré les ingrédients manquants");
}
async function undoCookMeal(meal){
 const r=recipeById(meal.recipeId);if(!r)return;
 if(!confirm(`Annuler « ${r.name} » comme repas réalisé ?\n\nLe stock utilisé par cette recette sera réajouté.`))return;
 for(const [name,q,u] of r.ingredients){let st=findStock(name);const need=quantityFor(name,q,u);if(st){st.qty+=need.q;await put("stock",st)}else{const ns={id:"s"+Date.now()+Math.random(),name:canonicalIngredient(name),qty:need.q,unit:need.unit,category:stockCategory(name).category,subcategory:stockCategory(name).subcategory};state.stock.push(ns);await put("stock",ns)}}
 meal.status="planned";delete meal.doneAt;await put("meals",meal);state.stock=await getAll("stock");state.meals=await getAll("meals");await rebuildShopping();render();showToast("↶ Repas annulé — stock restauré");
}
function showMissingModal(meal,r,a){
 showModal(`<button class="close" onclick="closeModal()">×</button><h2>Ingrédients manquants</h2><p class="muted">« ${esc(r.name)} » ne peut pas être réalisé complètement avec le stock actuel.</p><div class="list">${a.missing.map(x=>`<div class="row"><span>${esc(x.name)}</span><b>${fmt(x.shortage,x.unit)} manquant</b></div>`).join("")}</div><div class="actions"><button class="btn full" id="cookAnywayBtn">👩‍🍳 Cuisiner quand même</button><button class="btn secondary full" id="addMissingBtn">🛒 Ajouter les manquants aux courses</button><button class="btn ghost full" onclick="closeModal()">Fermer</button></div>`);
 document.getElementById("cookAnywayBtn").onclick=async()=>{closeModal();await cookMeal(meal,true)};
 document.getElementById("addMissingBtn").onclick=async()=>{const b=document.getElementById("addMissingBtn");b.disabled=true;b.textContent="Ajout en cours…";await addMissing(a.missing);closeModal()};
}

function render(){renderHome();renderMeals();renderRecipes();renderStock();renderShopping();document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===currentView));document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===currentView))}
function renderHome(){
 const today=dateKey(new Date()),todays=state.meals.filter(m=>m.date===today),planned=state.meals.filter(m=>m.status==="planned" && m.date>=today).length,low=state.stock.filter(s=>s.qty>0&&s.qty<=lowThreshold(s));
 document.getElementById("home").innerHTML=`<section class="hero home-hero"><div class="home-seasonline"><span>VOTRE CUISINE, AU FIL DES SAISONS</span><span class="season-tag">${activeSeasonLabel()}</span></div><div class="home-wordmark">Mamouni<span>♥</span></div><h1>Bonjour !</h1><p class="muted">Prête à cuisiner aujourd'hui ?</p><div class="stat-row"><div class="stat"><strong>${planned}</strong><span class="small">repas restants</span></div><div class="stat"><strong>${state.recipes.length}</strong><span class="small">recettes</span></div><div class="stat"><strong>${state.shopping.length}</strong><span class="small">courses</span></div></div></section><div class="home-shortcuts"><button class="shortcut" onclick="setView('recipes')"><svg viewBox="0 0 24 24"><use href="#icon-book"></use></svg><span>Mes recettes</span></button><button class="shortcut" onclick="setView('stock')"><svg viewBox="0 0 24 24"><use href="#icon-pantry"></use></svg><span>Mon stock</span></button><button class="shortcut" onclick="setView('shopping')"><svg viewBox="0 0 24 24"><use href="#icon-basket"></use></svg><span>Ma liste de courses</span></button><button class="shortcut" onclick="setView('meals')"><svg viewBox="0 0 24 24"><use href="#icon-cake"></use></svg><span>Mes gâteaux</span></button></div><div class="section-title home-section-title"><h2>Aujourd'hui</h2><span class="meta">${new Date().toLocaleDateString("fr-FR",{day:"numeric",month:"long"})}</span></div><div class="grid">${todays.length?todays.map(mealHomeCard).join(""):`<div class="card empty">Aucun repas planifié aujourd'hui.</div>`}</div><div class="section-title"><h2>À surveiller</h2><button class="btn ghost" onclick="setView('stock')">Voir le stock</button></div><div class="card">${low.length?`<div class="list">${low.slice(0,5).map(s=>`<div class="row"><span>${esc(s.name)}</span><span class="quantity">${fmt(s.qty,s.unit)}</span></div>`).join("")}</div>`:`<div class="empty">Votre stock ne présente pas de niveau faible.</div>`}</div><div class="section-title"><h2>Courses</h2><button class="btn ghost" onclick="setView('shopping')">Voir la liste</button></div><div class="card">${state.shopping.length?`<div class="list">${state.shopping.slice(0,5).map(s=>`<div class="row"><span>${esc(s.name)}</span><b>${s.type==="other"?esc(s.qtyText||"1"):fmt(s.qty,s.unit)}</b></div>`).join("")}</div>`:`<div class="empty">Aucun achat nécessaire pour le moment ♡</div>`}</div>`;
}
function activeSeasonLabel(){if(appSettings.specialEvent==="halloween")return "Halloween";return ({spring:"Printemps",summer:"Été",autumn:"Automne",winter:"Hiver"})[document.body.dataset.season]||"Automne"}
function mealHomeCard(m){const r=recipeById(m.recipeId);if(!r)return"";const a=availability(r);return `<div class="card meal-slot"><span>${m.slot==="midi"?"☀️":"🌙"}</span><button onclick="openRecipe(${inlineArg(r.id)})">${esc(r.name)}<div class="meta">${m.status==="done"?"✅ Réalisé":a.ok?"🟢 Tout est disponible":`🔴 ${a.missing.length} ingrédient(s) manquant(s)`}</div></button><button class="btn secondary" onclick="cookByMeal(${inlineArg(m.id)})">${m.status==="done"?"↶ Annuler":"Cuisiner"}</button></div>`}

let calendarCursor=new Date(new Date().getFullYear(),new Date().getMonth(),1);
let cakeCursor=new Date(new Date().getFullYear(),new Date().getMonth(),1);

function renderMeals(){
 const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth(),daysInMonth=new Date(y,m+1,0).getDate();
 const byDate={};state.meals.forEach(x=>(byDate[x.date]??=[]).push(x));
 const first=new Date(y,m,1), startOffset=(first.getDay()+6)%7, todayKey=dateKey(new Date());
 const cells=[];
 for(let i=0;i<startOffset;i++)cells.push(`<div class="calendar-cell empty-cell"></div>`);
 for(let d=1;d<=daysInMonth;d++){
   const key=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
   const items=(byDate[key]||[]).sort((a,b)=>a.slot.localeCompare(b.slot));
   const past=key<todayKey,isToday=key===todayKey;
   cells.push(`<button class="calendar-cell ${isToday?"today":""} ${past?"past":""}" onclick="openDay('${key}')"><span class="calendar-day">${d}</span><div class="calendar-meals">${items.map(meal=>{const r=recipeById(meal.recipeId);if(!r)return"";return `<span class="calendar-meal ${meal.status==="done"?"done":""}"><i>${meal.slot==="midi"?"☀️":"🌙"}</i>${esc(r.name)}</span>`}).join("")||`<span class="calendar-empty">+ repas</span>`}</div></button>`);
 }
 const cakeMonth=monthKey(cakeCursor),cakeLabel=cakeCursor.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
 const cakes=(state.cakes||[]).filter(c=>(c.month||monthKey(new Date()))===cakeMonth);
 const cakeCards=cakes.map(c=>{const a=cakeAvailability(c);return `<article class="cake-card"><div class="cake-card-icon">${esc(c.icon||"🍰")}</div><div class="cake-card-body"><b>${esc(c.name)}</b><div class="meta">${c.portions} pers. · ${c.status==="done"?"✅ Réalisé":"📅 Prévu"}</div><div class="small ${a.ok?"cake-ok":"cake-missing"}">${a.ok?"🟢 Ingrédients disponibles":`🔴 manque ${a.missing.length}`}</div></div><div class="cake-card-actions"><button class="pill" onclick="editCake(${inlineArg(c.id)})">Modifier</button>${c.status==="planned"?`<button class="btn secondary" ${a.ok?"":"disabled"} onclick="cookCake(${inlineArg(c.id)})">Faire</button>`:`<button class="pill" onclick="undoCake(${inlineArg(c.id)})">Annuler</button>`}</div></article>`}).join("");
 const cakeHtml=`<div class="cakes-panel"><div class="cakes-panel-head"><div><div class="section-emoji">🍰</div><h2>Mes gâteaux</h2><p class="muted">Une vue par mois, sans faire descendre le calendrier.</p></div><button class="btn secondary" onclick="newCake()">+ Ajouter</button></div><div class="cakes-month-nav"><button class="calendar-arrow" onclick="changeCakeMonth(-1)" aria-label="Mois précédent">‹</button><strong>Gâteaux — ${cakeLabel}</strong><div class="cake-nav-right"><span class="cake-count">${cakes.length} gâteau${cakes.length>1?"x":""}</span><button class="calendar-arrow" onclick="changeCakeMonth(1)" aria-label="Mois suivant">›</button></div></div>${cakes.length?`<div class="cakes-scroller">${cakeCards}</div>`:`<div class="cake-empty">Aucun gâteau prévu pour ${cakeLabel}.</div>`}</div>`;
 document.getElementById("meals").innerHTML=`<div class="section-title"><div><div class="section-emoji">📅</div><h1>Mes repas</h1><p class="muted" style="margin:3px 0 0">Un seul calendrier. Changez simplement de mois pour planifier plus loin.</p></div><button class="btn" type="button" onclick="openMealPlanner()">＋ Ajouter / remplacer</button></div>
 <div class="section-title calendar-heading"><button class="calendar-arrow" onclick="changeCalendarMonth(-1)" aria-label="Mois précédent">‹</button><h2>${calendarCursor.toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}</h2><div class="calendar-nav-right"><button class="calendar-today" onclick="goCalendarToday()">Aujourd'hui</button><button class="calendar-arrow" onclick="changeCalendarMonth(1)" aria-label="Mois suivant">›</button></div></div>
 <div class="calendar-wrap"><div class="calendar-weekdays">${["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(x=>`<span>${x}</span>`).join("")}</div><div class="calendar-grid">${cells.join("")}</div></div>
 ${cakeHtml}`;
}

function changeCakeMonth(delta){cakeCursor=new Date(cakeCursor.getFullYear(),cakeCursor.getMonth()+delta,1);renderMeals()}
function goCakeCurrentMonth(){cakeCursor=new Date(new Date().getFullYear(),new Date().getMonth(),1);renderMeals()}

function changeCalendarMonth(delta){calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+delta,1);renderMeals()}
function goCalendarToday(){calendarCursor=new Date(new Date().getFullYear(),new Date().getMonth(),1);renderMeals()}
function openDay(date){
 const today=dateKey(new Date()),past=date<today,items=state.meals.filter(m=>m.date===date).sort((a,b)=>a.slot.localeCompare(b.slot));
 const title=new Date(date+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
 const rows=["midi","soir"].map(slot=>{
   const meal=items.find(x=>x.slot===slot);
   if(!meal)return `<div class="day-detail-row"><div><b>${slot==="midi"?"☀️ Midi":"🌙 Soir"}</b><div class="meta">${past?"Journée passée":"Aucun repas prévu"}</div></div>${past?"":`<button class="btn secondary" onclick="closeModal();openMealPlanner(${inlineArg(date)},${inlineArg(slot)})">＋ Ajouter</button>`}</div>`;
   const r=recipeById(meal.recipeId),a=availability(r);
   return `<div class="day-detail-row"><div><b>${slot==="midi"?"☀️ Midi":"🌙 Soir"} · ${esc(r.name)}</b><div class="meta">${past?"🕰️ Journée passée · ":""}${meal.status==="done"?"✅ Réalisé":a.ok?"🟢 Disponible":"🔴 Ingrédients manquants"}</div></div><div class="actions">${past?`<button class="pill" onclick="closeModal();openRecipe(${inlineArg(r.id)})">Voir</button>`:`${meal.status==="planned"?`<button class="pill" onclick="closeModal();openRecipe(${inlineArg(r.id)})">Voir</button><button class="pill" onclick="closeModal();openMealPlanner(${inlineArg(date)},${inlineArg(slot)})">↔ Remplacer</button><button class="btn secondary" onclick="closeModal();cookByMeal(${inlineArg(meal.id)})">Cuisiner</button>`:`<button class="pill" onclick="closeModal();undoCookMeal(${inlineArg(meal.id)})">↶ Annuler</button>`}`}</div></div>`;
 }).join("");
 showModal(`<button class="close" onclick="closeModal()">×</button><div class="section-emoji">📅</div><h2>${title}</h2>${past?`<p class="muted">Cette journée est passée et n'entre plus dans le calcul des repas restants ni dans la liste de courses.</p>`:""}<div class="list">${rows}</div>${past?"":`<div class="actions"><button class="btn ghost full" onclick="closeModal();openMealPlanner(${inlineArg(date)},'midi')">＋ Ajouter / remplacer un repas</button></div>`}`);
}
function renderRecipes(){const q=(document.getElementById("recipeSearch")?.value||"").toLowerCase();let rs=state.recipes.filter(r=>r.name.toLowerCase().includes(q)||r.category.toLowerCase().includes(q));if(recipeFilter==="available")rs=rs.filter(r=>availability(r).ok);if(recipeFilter==="missing")rs=rs.filter(r=>!availability(r).ok);document.getElementById("recipes").innerHTML=`<div class="section-title"><div><div class="section-emoji">🍳</div><h1>Mes recettes</h1></div><button class="btn" onclick="newRecipe()">+ Ajouter</button></div><input id="recipeSearch" class="search" placeholder="Rechercher une recette..." value="${esc(q)}" oninput="renderRecipes()"><div class="filters"><button class="pill ${recipeFilter==="all"?"active":""}" onclick="recipeFilter='all';renderRecipes()">Toutes</button><button class="pill ${recipeFilter==="available"?"active":""}" onclick="recipeFilter='available';renderRecipes()">Disponibles</button><button class="pill ${recipeFilter==="missing"?"active":""}" onclick="recipeFilter='missing';renderRecipes()">Indisponibles</button></div><div class="grid grid-2">${rs.map(recipeCard).join("")||`<div class="card empty">Aucune recette trouvée.</div>`}</div>`}
function recipeCard(r){const a=availability(r);return `<article class="card recipe-card ${a.ok?"":"disabled"}"><div class="recipe-head"><div class="recipe-icon">${esc(r.icon||"🍽️")}</div><div style="flex:1"><h3>${esc(r.name)}</h3><div class="meta">${esc(r.category)} · ${r.prep+r.cook} min · ${r.portions} pers.</div><div style="margin-top:8px"><span class="badge ${a.ok?"ok":"bad"}">${a.ok?"✓ Disponible":`⚠ ${a.pct}% disponible`}</span></div></div></div>${!a.ok?`<div class="small muted" style="margin-top:9px">Manque : ${a.missing.slice(0,3).map(x=>`${esc(x.name)} (${fmt(x.shortage,x.unit)})`).join(" · ")}</div>`:""}<div class="actions"><button class="btn ${a.ok?"":"secondary"}" onclick="openRecipe(${inlineArg(r.id)})">Voir la recette</button><button class="pill" onclick="editRecipe(${inlineArg(r.id)})">Modifier</button>${a.ok?`<button class="btn secondary" onclick="quickCook(${inlineArg(r.id)})">J'ai cuisiné</button>`:""}</div></article>`}

function lowThreshold(s){return s.unit==="unit"?2:s.unit==="g"?200:s.unit==="ml"?200:10}
function renderStock(){
 const order=["Fruits & légumes","Secs","Conserves","Frais","Boucherie","Surgeles","Autres"];
 const cats={};state.stock.forEach(x=>{const c=x.category||stockCategory(x.name).category;(cats[c]??=[]).push(x)});
 const html=Object.keys(cats).sort((a,b)=>order.indexOf(a)-order.indexOf(b)).map(c=>{const subs={};cats[c].forEach(x=>(subs[x.subcategory||""]??=[]).push(x));return `<div class="section-title"><h2>${esc(c)}</h2></div><div class="card">${Object.entries(subs).map(([sub,arr])=>`${sub?`<h4 class="stock-subcategory">${esc(sub)}</h4>`:""}<div class="list">${arr.map(x=>`<div class="row"><div><b>${esc(x.name)}</b><div class="meta">${x.qty<=lowThreshold(x)?"⚠️ Niveau faible":"Stock actuel"}</div></div><div style="display:flex;align-items:center;gap:8px"><span class="quantity">${fmt(x.qty,x.unit)}</span><button class="pill" onclick="editStock(${inlineArg(x.id)})">Modifier</button></div></div>`).join("")}</div>`).join("")}</div>`}).join("");
 document.getElementById("stock").innerHTML=`<div class="section-title"><div><div class="section-emoji">🧺</div><h1>Mon stock</h1></div><button class="btn" onclick="newStock()">+ Ajouter</button></div><p class="muted">Fruits & légumes, secs (sucré / salé), conserves, frais, boucherie et surgelés.</p>${html||`<div class="card empty">Votre stock est vide.</div>`}`;
}
async function addOtherShopping(){
 showModal(`<button class="close" onclick="closeModal()">×</button><h2>Ajouter à mes courses ♡</h2><form class="form" id="otherShoppingForm"><label>Article<input name="name" required placeholder="Ex. Papier toilette"></label><label>Catégorie<select name="category"><option>Maison</option><option>Hygiène</option><option>Entretien</option><option>Bébé / enfant</option><option>Animaux</option><option>Autre</option></select></label><label>Quantité / note<input name="qtyText" placeholder="Ex. 2 ou 1 paquet"></label><button class="btn full">Ajouter aux courses</button></form>`);
 document.getElementById("otherShoppingForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);await put("shopping",{id:"o"+Date.now(),name:String(f.get("name")).trim(),qtyText:String(f.get("qtyText")||"1"),category:String(f.get("category")),checked:false,type:"other"});state.shopping=await getAll("shopping");closeModal();render();showToast("Article ajouté aux courses")};
}
async function toggleOtherShopping(id,checked){const x=state.shopping.find(s=>s.id===id);if(x){x.checked=checked;await put("shopping",x);state.shopping=await getAll("shopping");renderShopping()}}
async function deleteShopping(id){await del("shopping",id);state.shopping=await getAll("shopping");renderShopping();showToast("Article supprimé")}
function renderShopping(){
 const food=state.shopping.filter(s=>s.type!=="other");
 const other=state.shopping.filter(s=>s.type==="other");
 const grouped={}; food.forEach(x=>(grouped[x.category||stockCategory(x.name).category]??=[]).push(x));
 const otherGrouped={}; other.forEach(x=>(otherGrouped[x.category||"Autre"]??=[]).push(x));
 const foodHtml=Object.entries(grouped).map(([cat,items])=>`<div class="shopping-category"><h3>${esc(cat)}</h3><div class="list">${items.map(s=>`<div class="row shopping-row"><label style="display:flex;align-items:center;gap:10px;flex:1;min-width:0"><input class="check" type="checkbox" ${s.checked?"checked":""} onchange="toggleShopping(${inlineArg(s.id)},this.checked)"><span><b>${esc(s.name)}</b><div class="meta">À acheter</div></span></label><label class="purchase-field"><span class="small">${fmt(s.qty,s.unit)}</span><input id="buy-${esc(s.id)}" type="number" min="0" max="${s.qty}" step="0.001" value="${s.qty}" inputmode="decimal"><span class="small">${esc(s.unit)}</span></label></div>`).join("")}</div></div>`).join("");
 const otherHtml=Object.entries(otherGrouped).map(([cat,items])=>`<div class="shopping-category"><h3>🛍️ ${esc(cat)}</h3><div class="list">${items.map(s=>`<div class="row"><label style="display:flex;align-items:center;gap:10px;flex:1"><input class="check" type="checkbox" ${s.checked?"checked":""} onchange="toggleOtherShopping(${inlineArg(s.id)},this.checked)"><span style="${s.checked?"text-decoration:line-through;opacity:.5":""}"><b>${esc(s.name)}</b><div class="meta">${esc(s.qtyText||"")}</div></span></label><button class="pill" onclick="deleteShopping(${inlineArg(s.id)})">×</button></div>`).join("")}</div></div>`).join("");
 document.getElementById("shopping").innerHTML=`<div class="section-title"><div><div class="section-emoji">🛒</div><h1>Ma liste de courses</h1></div><div class="actions"><button class="btn" onclick="addOtherShopping()">+ Autre</button><button class="btn secondary" onclick="rebuildShopping().then(render)">↻ Recalculer</button></div></div>
 <div class="card"><p class="muted">Alimentaire et non alimentaire sont réunis ici. Les achats alimentaires partiels restent calculés automatiquement selon vos besoins.</p>
 ${foodHtml||`<div class="empty">Aucun achat alimentaire nécessaire ♡</div>`}
 </div>
 <div class="section-title"><h2>Autres achats</h2></div>
 <div class="card">${otherHtml||`<div class="empty">Aucun article non alimentaire.</div>`}</div>
 ${food.length?`<div class="actions"><button class="btn full" onclick="purchaseChecked()">✓ Enregistrer mes achats alimentaires</button></div>`:""}`;
}
async function toggleShopping(id,checked){const s=state.shopping.find(x=>x.id===id);if(s){s.checked=checked;await put("shopping",s);state.shopping=await getAll("shopping");renderShopping()}}
async function purchaseChecked(){
 const checked=state.shopping.filter(s=>s.checked && s.type!=="other");
 if(!checked.length){showToast("Cochez d'abord les produits achetés");return}
 let changed=false;
 for(const item of checked){
   const input=document.getElementById("buy-"+item.id);
   let bought=Number(input?.value);
   if(!Number.isFinite(bought)||bought<0)bought=0;
   bought=Math.min(bought,item.qty);
   if(bought<=0)continue;
   let stock=findStock(item.name);
   const boughtBase=quantityFor(item.name,bought,item.unit);
   if(stock){
     const stockBase=unitBase(item.name,stock.qty,stock.unit);
     if(stockBase.unit!==boughtBase.unit){showToast(`Unité différente pour ${item.name} : vérifiez le stock`);continue}
     stock.qty=stockBase.q+boughtBase.q;
     await put("stock",stock);
   }else{
     const ns={id:"s"+Date.now()+Math.random(),name:canonicalIngredient(item.name),qty:boughtBase.q,unit:boughtBase.unit,category:stockCategory(item.name).category,subcategory:stockCategory(item.name).subcategory};
     await put("stock",ns);
   }
   const remaining=Math.max(0,item.qty-bought);
   if(remaining>1e-9){
     item.qty=remaining;
     item.checked=false;
     await put("shopping",item);
   }else{
     await del("shopping",item.id);
   }
   changed=true;
 }
 state.stock=await getAll("stock");
 await rebuildShopping();
 render();
 showToast(changed?"✓ Achat enregistré — stock et courses mis à jour":"Indiquez une quantité achetée supérieure à 0");
}

async function quickCook(rid){const m=state.meals.find(m=>m.status==="planned"&&m.recipeId===rid);if(m)await cookMeal(m);else{const r=recipeById(rid);if(r&&availability(r).ok){const temp={id:"temp",recipeId:rid,status:"planned"};await cookMeal(temp)}}}
async function cookByMeal(id){const m=state.meals.find(x=>x.id===id);if(m)await cookMeal(m)}

function addMeal(){openMealPlanner()}

function openMealPlanner(date=dateKey(new Date()),slot="midi"){
 const existing=state.meals.find(m=>m.date===date&&m.slot===slot),options=state.recipes.map(r=>`<option value="${esc(r.id)}" ${existing?.recipeId===r.id?"selected":""}>${esc(r.name)}</option>`).join("");
 showModal(`<button class="close" onclick="closeModal()">×</button><h2>${existing?"Modifier":"Ajouter"} un repas ♡</h2><p class="muted">Choisissez librement le jour, le créneau et la recette. Si un repas existe déjà, il sera remplacé.</p><form class="form" id="mealForm"><label>Date<input name="date" type="date" required value="${date}"></label><label>Créneau<select name="slot"><option value="midi" ${slot==="midi"?"selected":""}>☀️ Midi</option><option value="soir" ${slot==="soir"?"selected":""}>🌙 Soir</option></select></label><label>Recette<select name="recipe" required>${options}</select></label><button class="btn full">${existing?"Remplacer le repas":"Ajouter le repas"}</button>${existing?`<button type="button" class="btn ghost full" onclick="removeMeal(${inlineArg(existing.id)})">Supprimer ce repas</button>`:""}</form>`);
 document.getElementById("mealForm").onsubmit=saveMealPlan;
}
async function saveMealPlan(e){
 e.preventDefault();const f=new FormData(e.target),date=f.get("date"),slot=f.get("slot"),recipeId=f.get("recipe");
 const same=state.meals.find(m=>m.date===date&&m.slot===slot);
 if(same){if(same.status==="done"){if(!confirm("Ce repas a déjà été réalisé. Le remplacer va restaurer son stock et placer la nouvelle recette à sa place. Continuer ?"))return;await undoCookMealNoConfirm(same)}same.recipeId=recipeId;same.status="planned";delete same.doneAt;await put("meals",same)}
 else{await put("meals",{id:date+"-"+slot,date,slot,recipeId,status:"planned"})}
 state.meals=await getAll("meals");await rebuildShopping();closeModal();render();showToast("✓ Repas enregistré dans le planning");
}
async function undoCookMealNoConfirm(meal){const r=recipeById(meal.recipeId);if(!r)return;for(const [name,q,u] of r.ingredients){const need=quantityFor(name,q,u);let s=findStock(name);if(s){s.qty+=need.q;await put("stock",s)}else{const ns={id:"s"+Date.now()+Math.random(),name:canonicalIngredient(name),qty:need.q,unit:need.unit,category:stockCategory(name).category,subcategory:stockCategory(name).subcategory};await put("stock",ns)}}meal.status="planned";delete meal.doneAt;await put("meals",meal);state.stock=await getAll("stock")}
async function removeMeal(id){const m=state.meals.find(x=>x.id===id);if(!m)return;if(m.status==="done"){if(!confirm("Ce repas a été réalisé. Le supprimer restaurera les ingrédients utilisés. Continuer ?"))return;await undoCookMealNoConfirm(m)}await del("meals",id);state.meals=await getAll("meals");await rebuildShopping();closeModal();render();showToast("✓ Repas supprimé du planning")}

function openRecipe(id){const r=recipeById(id),a=availability(r);showModal(`<button class="close" onclick="closeModal()">×</button><div class="recipe-head"><div class="recipe-icon">${esc(r.icon||"🍽️")}</div><div><h2>${esc(r.name)}</h2><div class="meta">${esc(r.category)} · préparation ${r.prep} min · cuisson ${r.cook} min · ${r.portions} personnes</div></div></div><div class="section-title"><h3>Ingrédients</h3><span class="badge ${a.ok?"ok":"bad"}">${a.ok?"Tout est disponible":`${a.pct}% disponible`}</span></div><div class="card"><div class="list">${r.ingredients.map(([n,q,u])=>{const need=quantityFor(n,q,u),s=findStock(n),have=s?unitBase(n,s.qty,s.unit).q:0,ok=have>=need.q;return `<div class="row"><span>${esc(canonicalIngredient(n))}</span><span><b>${fmt(q,u)}</b> <span class="small">${ok?"🟢":"🔴 "+fmt(Math.max(0,need.q-have),need.unit)+" manquant"}</span></span></div>`}).join("")}</div></div><div class="section-title"><h3>Préparation</h3></div><div class="card"><ol>${r.steps.map(x=>`<li style="margin:9px 0">${esc(x)}</li>`).join("")}</ol></div><div class="actions"><button class="btn secondary full" onclick="closeModal();editRecipe(${inlineArg(r.id)})">✎ Modifier la recette</button>${a.ok?`<button class="btn full" onclick="closeModal();quickCook(${inlineArg(r.id)})">✓ J'ai cuisiné</button>`:`<button class="btn full" id="recipeMissingBtn">🛒 Ajouter les manquants aux courses</button>`}</div>`);if(!a.ok)document.getElementById("recipeMissingBtn").onclick=async()=>{await addMissing(a.missing);closeModal()}}

function newRecipe(){showRecipeForm()}
function editRecipe(id){const r=recipeById(id);if(r)showRecipeForm(r)}
function showRecipeForm(r=null){const isEdit=!!r;showModal(`<button class="close" onclick="closeModal()">×</button><h2>${isEdit?"Modifier la recette":"Nouvelle recette ♡"}</h2><form class="form" id="recipeForm"><label>Nom<input name="name" required placeholder="Ex. Gratin de pommes de terre" value="${isEdit?esc(r.name):""}"></label><label>Catégorie<select name="category"><option ${r?.category==="Plat"?"selected":""}>Plat</option><option ${r?.category==="Soupe"?"selected":""}>Soupe</option><option ${r?.category==="Dessert"?"selected":""}>Dessert</option><option ${r?.category==="Boisson"?"selected":""}>Boisson</option><option ${r?.category==="Autre"?"selected":""}>Autre</option></select></label><div class="grid grid-2"><label>Préparation (min)<input name="prep" type="number" min="0" value="${isEdit?r.prep:10}"></label><label>Cuisson (min)<input name="cook" type="number" min="0" value="${isEdit?r.cook:20}"></label></div><label>Portions<input name="portions" type="number" min="1" value="${isEdit?r.portions:2}"></label><h3>Ingrédients</h3><div id="ingredientEditor"></div><button type="button" class="btn secondary" onclick="addIngredientLine()">+ Ajouter un ingrédient</button><label>Préparation<textarea name="steps" rows="5" style="width:100%;padding:12px;border:1px solid var(--line);border-radius:12px;background:#fffdf9" placeholder="Une étape par ligne">${isEdit?esc((r.steps||[]).join("\n")):""}</textarea></label><button class="btn full">${isEdit?"Enregistrer les modifications":"Enregistrer"}</button></form>`);
 if(isEdit && r.ingredients?.length){r.ingredients.forEach(x=>addIngredientLine(x))}else{addIngredientLine();addIngredientLine()}
 document.getElementById("recipeForm").onsubmit=e=>saveRecipe(e,r)
}
function addIngredientLine(value=null){const d=document.createElement("div");d.className="ingredient-line";d.innerHTML=`<input class="ing-name" placeholder="Ingrédient" required value="${value?esc(value[0]):""}"><input class="ing-qty" type="number" step="0.001" min="0" placeholder="Qté" required value="${value?value[1]:""}"><select class="ing-unit"><option value="g" ${value?.[2]==="g"||value?.[2]==="kg"?"selected":""}>g</option><option value="ml" ${value?.[2]==="ml"||value?.[2]==="cl"||value?.[2]==="L"?"selected":""}>ml</option><option value="unit" ${value?.[2]==="unit"?"selected":""}>unité</option></select><button type="button" class="pill" onclick="this.parentElement.remove()">×</button>`;document.getElementById("ingredientEditor").appendChild(d)}
async function saveRecipe(e,existing=null){e.preventDefault();const f=new FormData(e.target),ings=[...document.querySelectorAll(".ingredient-line")].map(x=>[x.querySelector(".ing-name").value.trim(),Number(x.querySelector(".ing-qty").value),x.querySelector(".ing-unit").value]).filter(x=>x[0]);const normalizedIngs=ings.map(([name,q,u])=>{const n=canonicalIngredient(name),b=unitBase(n,q,u);return [n,b.q,b.unit]});const r={id:existing?.id||"r"+Date.now(),name:String(f.get("name")).trim(),icon:existing?.icon||"🍽️",prep:Number(f.get("prep")),cook:Number(f.get("cook")),portions:Number(f.get("portions")),category:f.get("category"),ingredients:normalizedIngs,steps:String(f.get("steps")).split("\n").map(x=>x.trim()).filter(Boolean)};await put("recipes",r);state.recipes=await getAll("recipes");await rebuildShopping();closeModal();render();showToast(existing?"✓ Recette modifiée":"✓ Recette ajoutée")}

function newStock(){showStockForm()}
function editStock(id){const s=state.stock.find(x=>x.id===id);showStockForm(s)}
function showStockForm(s){
 const auto=s?stockCategory(s.name):{category:"Fruits & légumes",subcategory:""};
 showModal(`<button class="close" onclick="closeModal()">×</button><h2>${s?"Modifier":"Ajouter"} un stock</h2><form class="form" id="stockForm"><label>Ingrédient<input name="name" required value="${s?esc(s.name):""}" placeholder="Ex. Tomates"></label><label>Catégorie<select name="category"><option>Fruits & légumes</option><option>Secs</option><option>Conserves</option><option>Frais</option><option>Boucherie</option><option>Surgeles</option><option>Autres</option></select></label><label>Sous-catégorie (pour les secs)<select name="subcategory"><option value="">—</option><option>Sucré</option><option>Salé</option><option>Épices</option></select></label><div class="grid grid-2"><label>Quantité<input name="qty" type="number" step="0.001" min="0" required value="${s?s.qty:""}"></label><label>Unité<select name="unit"><option value="g" ${s?.unit==="g"||s?.unit==="kg"?"selected":""}>g</option><option value="ml" ${s?.unit==="ml"||s?.unit==="cl"||s?.unit==="L"?"selected":""}>ml</option><option value="unit" ${s?.unit==="unit"?"selected":""}>unité</option></select></label></div><button class="btn full">Enregistrer</button>${s?`<button type="button" class="btn ghost full" onclick="deleteStock(${inlineArg(s.id)})">Supprimer</button>`:""}</form>`);
 document.querySelector('#stockForm [name="category"]').value=s?.category||auto.category;document.querySelector('#stockForm [name="subcategory"]').value=s?.subcategory||auto.subcategory;
 document.getElementById("stockForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),name=canonicalIngredient(String(f.get("name")).trim()),auto2=stockCategory(name),base=unitBase(name,Number(f.get("qty")),f.get("unit")),obj={id:s?s.id:"s"+Date.now(),name,qty:base.q,unit:base.unit,category:String(f.get("category")||auto2.category),subcategory:String(f.get("subcategory")||auto2.subcategory)};await put("stock",obj);state.stock=await getAll("stock");await rebuildShopping();closeModal();render();showToast("✓ Stock enregistré")};
}
async function deleteStock(id){await del("stock",id);state.stock=await getAll("stock");await rebuildShopping();closeModal();render();showToast("✓ Article supprimé du stock")}


function restoreMealStock(m){const r=recipeById(m.recipeId);if(!r)return;for(const [name,q,u] of r.ingredients){const st=findStock(name),need=quantityFor(name,q,u);if(st)st.qty+=need.q;}}
async function undoMeal(id){const m=state.meals.find(x=>x.id===id);if(!m||m.status!=="done")return;restoreMealStock(m);m.status="planned";delete m.doneAt;const r=recipeById(m.recipeId);if(r)for(const [name,q] of r.ingredients){const st=findStock(name);if(st)put("stock",st)}await put("meals",m);state.stock=await getAll("stock");state.meals=await getAll("meals");await rebuildShopping();render();showToast("↶ Repas annulé — stock restauré");}

function cakeAvailability(c){let missing=[];for(const [name,q,u] of c.ingredients){const need=quantityFor(name,q,u),st=findStock(name),have=st?unitBase(name,st.qty,st.unit).q:0;if(have+1e-9<need.q)missing.push({name:canonicalIngredient(name),shortage:need.q-have,unit:need.unit})}return {ok:missing.length===0,missing}}
async function cookCake(id){const c=state.cakes.find(x=>x.id===id);if(!c)return;const a=cakeAvailability(c);if(!a.ok){showToast("Il manque des ingrédients pour ce gâteau");return}for(const [name,q,u] of c.ingredients){const st=findStock(name),need=quantityFor(name,q,u);if(st){const have=unitBase(name,st.qty,st.unit).q;st.qty=Math.max(0,have-need.q);await put("stock",st)}}c.status="done";c.doneAt=new Date().toISOString();await put("cakes",c);state.stock=await getAll("stock");state.cakes=await getAll("cakes");await rebuildShopping();render();showToast("🍰 Gâteau réalisé — stock mis à jour")}
async function undoCake(id){const c=state.cakes.find(x=>x.id===id);if(!c||c.status!=="done")return;for(const [name,q,u] of c.ingredients){const st=findStock(name),need=quantityFor(name,q,u);if(st){st.qty+=need.q;await put("stock",st)}}c.status="planned";delete c.doneAt;await put("cakes",c);state.stock=await getAll("stock");state.cakes=await getAll("cakes");await rebuildShopping();render();showToast("↶ Gâteau annulé — stock restauré")}
function newCake(){showCakeForm()}
function editCake(id){showCakeForm(state.cakes.find(x=>x.id===id))}
function showCakeForm(c){
 showModal(`<button class="close" onclick="closeModal()">×</button><h2>${c?"Modifier":"Ajouter"} un gâteau ♡</h2><form class="form" id="cakeForm"><label>Nom<input name="name" required value="${c?esc(c.name):""}" placeholder="Ex. Fondant au chocolat"></label><label>Portions<input name="portions" type="number" min="1" value="${c?c.portions:6}"></label><h3>Ingrédients</h3><div id="cakeIngredients"></div><button type="button" class="btn secondary" onclick="addCakeIngredientLine()">+ Ajouter un ingrédient</button><button class="btn full">Enregistrer</button></form>`);
 (c?.ingredients||[["",0,"g"],["",0,"unit"]]).forEach(x=>addCakeIngredientLine(x));
 document.getElementById("cakeForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),ings=[...document.querySelectorAll(".cake-ingredient-line")].map(x=>[x.querySelector(".ing-name").value.trim(),Number(x.querySelector(".ing-qty").value),x.querySelector(".ing-unit").value]).filter(x=>x[0]);const obj={id:c?c.id:"cake"+Date.now(),name:String(f.get("name")),icon:"🍰",portions:Number(f.get("portions")),ingredients:ings,status:c?.status||"planned",month:c?.month||monthKey(cakeCursor)};await put("cakes",obj);state.cakes=await getAll("cakes");await rebuildShopping();closeModal();render();showToast("Gâteau enregistré ♡")};
}
function addCakeIngredientLine(v=["",0,"g"]){const d=document.createElement("div");d.className="ingredient-line cake-ingredient-line";d.innerHTML=`<input class="ing-name" placeholder="Ingrédient" value="${esc(v[0])}" required><input class="ing-qty" type="number" step="0.001" min="0" value="${v[1]}" required><select class="ing-unit"><option value="g" ${v[2]==="g"||v[2]==="kg"?"selected":""}>g</option><option value="ml" ${v[2]==="ml"||v[2]==="cl"||v[2]==="L"?"selected":""}>ml</option><option value="unit" ${v[2]==="unit"?"selected":""}>unité</option></select><button type="button" class="pill" onclick="this.parentElement.remove()">×</button>`;document.getElementById("cakeIngredients").appendChild(d)}

function setView(v){currentView=v;render()}
function stableJson(value){
  if(Array.isArray(value))return `[${value.map(stableJson).join(",")}]`;
  if(value&&typeof value==="object")return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function sameRows(actual,expected){
  if(!Array.isArray(actual)||actual.length!==expected.length)return false;
  const orderedActual=[...actual].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  const orderedExpected=[...expected].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  return orderedActual.every((row,index)=>stableJson(row)===stableJson(orderedExpected[index]));
}
function atomicReplaceData(nextStores,nextSettings,{saveRollback=true}={}){
  return new Promise((resolve,reject)=>{
    let transaction;
    try{transaction=db.transaction(DB_STORE_NAMES,"readwrite")}catch(error){reject(error);return}
    let previous={stores:{},settings:null},pending=STORE_NAMES.length+1,failure=null;
    const abort=error=>{failure=error;try{transaction.abort()}catch{}};
    transaction.oncomplete=()=>resolve();
    transaction.onabort=()=>reject(failure||transaction.error||new Error("La restauration a été annulée. Les anciennes données sont restées en place."));
    transaction.onerror=()=>{failure=transaction.error||new Error("La restauration a échoué.")};
    const ready=()=>{
      pending--;
      if(pending!==0)return;
      const rollbackSnapshot={createdAt:new Date().toISOString(),stores:previous.stores,settings:previous.settings||{...appSettings}};
      try{
        for(const name of STORE_NAMES){
          const store=transaction.objectStore(name);
          store.clear();
          for(const row of nextStores[name])store.put(row);
          const verification=store.getAll();
          verification.onsuccess=()=>{if(!sameRows(verification.result,nextStores[name]))abort(new Error(`Vérification impossible pour la section ${name}.`))};
        }
        const meta=transaction.objectStore("meta");
        meta.put(nextSettings);
        if(saveRollback)meta.put({id:"last-import-rollback",snapshot:rollbackSnapshot,dirty:false,used:false});
        else{
          const oldRollback=meta.get("last-import-rollback");
          oldRollback.onsuccess=()=>{if(oldRollback.result)meta.put({...oldRollback.result,dirty:true,used:true})};
        }
        const verification=meta.get("app-settings");
        verification.onsuccess=()=>{if(stableJson(verification.result)!==stableJson(nextSettings))abort(new Error("Vérification des réglages impossible."))};
      }catch(error){abort(error)}
    };
    for(const name of STORE_NAMES){
      const request=transaction.objectStore(name).getAll();
      request.onsuccess=()=>{previous.stores[name]=request.result;ready()};
    }
    const settingsRequest=transaction.objectStore("meta").get("app-settings");
    settingsRequest.onsuccess=()=>{previous.settings=settingsRequest.result||null;ready()};
  });
}
async function exportBackup(){
  const snapshot=await readDataSnapshot();
  const payload={
    format:"matbakh-backup",
    version:1,
    appVersion:APP_VERSION,
    exportedAt:new Date().toISOString(),
    dbName:DB_NAME,
    stores:snapshot.stores,
    settings:{
      season:snapshot.settings?.season||"auto",
      specialEvent:snapshot.settings?.specialEvent||null,
      unitWeights:snapshot.settings?.unitWeights||null
    }
  };
  const json=JSON.stringify(payload,null,2);
  const file=new File([json],`matbakh-sauvegarde-${new Date().toISOString().slice(0,10)}.json`,{type:"application/json"});
  try{
    if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
      await navigator.share({title:"Sauvegarde Matbakh",text:"Sauvegarde de mes recettes, stocks, repas et courses.",files:[file]});
      showToast("✓ Sauvegarde prête à être transférée");
      return;
    }
  }catch(e){ if(e?.name==="AbortError")return; }
  const a=document.createElement("a");a.href=URL.createObjectURL(file);a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  showToast("✓ Sauvegarde téléchargée");
}
function pickBackup(){document.getElementById("backupFileInput")?.click()}
async function importBackup(file){
  if(!file)return;
  try{
    if(file.size>10*1024*1024)throw new Error("Ce fichier dépasse la limite de 10 Mo.");
    const payload=JSON.parse(await file.text()),checked=window.MamouniData.validateBackup(payload),counts=checked.counts;
    const event=checked.settings.specialEvent||null,season=event?"autumn":(checked.settings.season||"auto");
    const nextSettings={id:"app-settings",season,specialEvent:event,unitWeights:checked.settings.unitWeights||null};
    const weights={"Pommes de terre":150};
    try{const saved=JSON.parse(nextSettings.unitWeights||"{}");if(Number(saved.potato)>0)weights["Pommes de terre"]=Number(saved.potato)}catch{}
    const manualShopping=checked.stores.shopping.filter(item=>item.type==="other");
    const generatedShopping=calculateFoodShopping(checked.stores,dateKey(new Date()),weights);
    const manualIds=new Set(manualShopping.map(item=>item.id));
    if(generatedShopping.some(item=>manualIds.has(item.id)))throw new Error("Une ligne de courses manuelle entre en conflit avec une ligne calculée.");
    const nextStores={...checked.stores,shopping:[...manualShopping,...generatedShopping]};
    if(!confirm(`Restaurer cette sauvegarde ?\n\nRecettes : ${counts.recipes}\nStock : ${counts.stock}\nRepas : ${counts.meals}\nCourses calculées : ${generatedShopping.length}\nAutres achats : ${manualShopping.length}\nGâteaux : ${counts.cakes}\n\nChaque section doit être présente dans le fichier. Les données actuelles seront remplacées en une seule transaction. Une copie de retour arrière sera conservée jusqu’à la prochaine modification.`))return;
    await atomicReplaceData(nextStores,nextSettings,{saveRollback:true});
    await loadData();await loadAppSettings();render();closeModal();showToast(`✓ Sauvegarde restaurée — ${state.recipes.length} recettes`);
  }catch(e){showToast(`⚠️ Import annulé : ${e?.message||"fichier invalide"}`)}
}
async function rollbackLastImport(){
  try{
    const previous=await getOne("meta","last-import-rollback");
    if(!previous?.snapshot||previous.dirty||previous.used){showToast("Le retour arrière n’est disponible qu’avant la prochaine modification des données.");return}
    const counts=Object.fromEntries(STORE_NAMES.map(name=>[name,previous.snapshot.stores[name]?.length||0]));
    if(!confirm(`Restaurer l’état qui précédait le dernier import ?\n\nRecettes : ${counts.recipes}\nStock : ${counts.stock}\nRepas : ${counts.meals}\nCourses : ${counts.shopping}\nGâteaux : ${counts.cakes}\n\nL’état actuel sera remplacé.`))return;
    await atomicReplaceData(previous.snapshot.stores,previous.snapshot.settings||appSettings,{saveRollback:false});
    await loadData();await loadAppSettings();render();closeModal();showToast("✓ État précédent restauré");
  }catch(error){showToast(`⚠️ Retour arrière impossible : ${error?.message||"erreur locale"}`)}
}
function showDataManager(){
  showModal(`<button class="close" onclick="closeModal()">×</button><div class="section-emoji">💾</div><h2>Mes données</h2><p class="muted">Les données restent sur cet appareil. Sur iPhone, Safari et l’app ajoutée à l’écran d’accueil peuvent avoir des stockages séparés. La sauvegarde JSON permet de les transférer.</p><div class="card"><b>⬆️ Exporter une sauvegarde</b><p class="muted small">Recettes, stock, repas, courses, gâteaux et réglages. Enregistrez le fichier dans Fichiers.</p><button class="btn full" onclick="exportBackup()">Exporter mes données</button></div><div class="card"><b>⬇️ Restaurer une sauvegarde</b><p class="muted small">Les cinq sections doivent être présentes. Les courses alimentaires sont recalculées à partir des repas, du stock et des gâteaux.</p><button class="btn secondary full" onclick="pickBackup()">Importer mes données</button><input id="backupFileInput" type="file" accept="application/json,.json" hidden onchange="importBackup(this.files?.[0]);this.value=''"/></div><div class="card"><b>🛡️ Protection</b><p class="muted small">L’import s’effectue en une transaction. En cas d’erreur, les données précédentes restent en place. Après un import réussi, le retour arrière reste disponible jusqu’à la prochaine modification.</p></div>${hasImportRollback?`<div class="card"><b>↶ Annuler le dernier import</b><p class="muted small">Restaurer l’état enregistré juste avant le dernier import.</p><button class="btn ghost full" onclick="rollbackLastImport()">Restaurer l’état précédent</button></div>`:""}`);
}

function showConverter(){
 showModal(`<button class="close" onclick="closeModal()">×</button><div class="section-emoji">↔</div><h2>Convertisseur</h2><p class="muted">Convertissez instantanément les unités de cuisine les plus courantes.</p><div class="converter-grid"><label>Valeur<input id="convValue" type="number" step="0.001" value="1" oninput="runConverter()"></label><label>De<select id="convFrom" onchange="runConverter()"><option value="kg">kg</option><option value="g">g</option><option value="L">L</option><option value="cl">cl</option><option value="ml">ml</option></select></label><label>Vers<select id="convTo" onchange="runConverter()"><option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="cl">cl</option><option value="L">L</option></select></label></div><div id="convResult" class="converter-result">1 kg = 1 000 g</div><div class="card converter-note"><b>🥔 Pommes de terre</b><div class="muted">1 pdt ≈ ${UNIT_WEIGHT_G["Pommes de terre"]} g pour relier les recettes en unités au stock en grammes.</div><div class="actions"><button class="pill" onclick="changePotatoWeight()">Modifier le poids moyen</button></div></div>`);
 runConverter();
}
function convertSimple(q,from,to){const factors={g:1,kg:1000,ml:1,cl:10,L:1000};const groups={g:"weight",kg:"weight",ml:"volume",cl:"volume",L:"volume"};if(groups[from]!==groups[to])return null;return Number(q)*factors[from]/factors[to]}
function runConverter(){const q=Number(document.getElementById("convValue")?.value||0),from=document.getElementById("convFrom")?.value,to=document.getElementById("convTo")?.value,out=document.getElementById("convResult");if(!out)return;const v=convertSimple(q,from,to);out.textContent=v===null?"Conversion impossible entre ces unités":""+trim(q)+" "+from+" = "+trim(v)+" "+to}
function changePotatoWeight(){const current=UNIT_WEIGHT_G["Pommes de terre"];showModal(`<button class="close" onclick="showConverter()">×</button><h2>Poids moyen d’une pomme de terre 🥔</h2><p class="muted">Cette valeur permet à Mamouni de convertir automatiquement « 8 pdt » en grammes dans le stock.</p><label class="form">1 pomme de terre<input id="potatoWeight" type="number" min="1" step="1" value="${current}"> g</label><button class="btn full" onclick="savePotatoWeight()">Enregistrer</button>`)}
function savePotatoWeight(){const v=Number(document.getElementById("potatoWeight")?.value);if(!Number.isFinite(v)||v<=0)return;UNIT_WEIGHT_G["Pommes de terre"]=v;appSettings.unitWeights=JSON.stringify({potato:v});put("meta",appSettings).catch(()=>showToast("Le réglage n’a pas pu être mémorisé."));closeModal();showConverter();showToast("✓ Poids moyen des pommes de terre mis à jour")}
function autoSeason(){const m=new Date().getMonth()+1;return m>=3&&m<=5?"spring":m>=6&&m<=8?"summer":m>=9&&m<=11?"autumn":"winter"}
function showSeasonPicker(){
 const current=document.body.dataset.season||autoSeason(),event=appSettings.specialEvent;
 showModal(`<button class="close" onclick="closeModal()">×</button><div class="section-emoji">✿</div><h2>Choisir une ambiance</h2><p class="muted">Une identité douce et illustrée accompagne vos recettes au fil de l'année.</p><div class="season-options"><button class="season-option ${appSettings.season==="spring"&&!event?"active":""}" onclick="applySeason('spring');closeModal();render()">Printemps</button><button class="season-option ${appSettings.season==="summer"&&!event?"active":""}" onclick="applySeason('summer');closeModal();render()">Été</button><button class="season-option ${current==="autumn"&&!event?"active":""}" onclick="applySeason('autumn');closeModal();render()">Automne</button><button class="season-option ${appSettings.season==="winter"&&!event?"active":""}" onclick="applySeason('winter');closeModal();render()">Hiver</button></div><button class="season-option halloween-option ${event==="halloween"?"active":""}" onclick="applySeason('autumn','${event==="halloween"?"":"halloween"}');closeModal();render()">${event==="halloween"?"✓ Halloween activé":"Activer l'ambiance Halloween"}</button><button class="btn ghost full" onclick="applySeason('auto');closeModal();render()">↻ Suivre automatiquement la saison</button>`)
}

function showModal(html){document.getElementById("modalRoot").innerHTML=`<div class="modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="modal">${html}</div></div>`}
function closeModal(){document.getElementById("modalRoot").innerHTML=""}
let toastTimer;function showToast(t){clearTimeout(toastTimer);const x=document.createElement("div");x.textContent=t;x.style="position:fixed;z-index:100;left:50%;bottom:92px;transform:translateX(-50%);background:#5d4a43;color:white;padding:12px 16px;border-radius:999px;box-shadow:0 8px 25px #0002;font-size:13px;max-width:90vw;text-align:center";document.body.appendChild(x);toastTimer=setTimeout(()=>x.remove(),2600)}

document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>setView(b.dataset.view));
window.addEventListener("error",e=>{
  const splash=document.getElementById("splash");
  if(splash) splash.classList.add("is-hidden");
  const main=document.getElementById("main");
  if(main && !main.dataset.fatal){
    main.dataset.fatal="1";
    main.innerHTML=`<div class="card empty"><h2>Un petit problème est survenu</h2><p class="muted">Matbakh n’a pas pu terminer son chargement. Rechargez la page. Si le problème persiste, ouvrez la console du navigateur ou transmettez cette erreur : ${esc(e?.message||"Erreur inconnue")}</p></div>`;
  }
});
window.addEventListener("unhandledrejection", e=>{
  const splash=document.getElementById("splash");
  if(splash) splash.classList.add("is-hidden");
});

(async()=>{
 const splash=document.getElementById("splash"),splashStart=performance.now();
 const finishSplash=()=>{
   const minDuration=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches?120:1100,wait=Math.max(0,minDuration-(performance.now()-splashStart));
   setTimeout(()=>splash?.classList.add("is-hidden"),wait);
 };
 try{
   await openDB();await loadAppSettings();await loadData();
   try{const wasPersistent=await navigator.storage?.persisted?.();const isPersistent=wasPersistent||await navigator.storage?.persist?.();window.__mamouniStoragePersistence=isPersistent?"persistent":"best-effort"}catch{window.__mamouniStoragePersistence="best-effort"}
   render();
   window.__matbakhBootFinished=true;
   if("serviceWorker" in navigator&&location.protocol!=="file:")navigator.serviceWorker.register("sw.js?v=v6-seasonal-identity-r1",{updateViaCache:"none"}).catch(()=>{});
   finishSplash();
 }catch(e){
   window.__matbakhBootFinished=true;
   document.getElementById("main").innerHTML=`<div class="card empty"><h2>Impossible de charger Matbakh</h2><p class="muted">${esc(e.message||"Erreur inconnue")}</p><button class="btn" onclick="location.reload()">Recharger</button></div>`;
   finishSplash();
 }
})();
