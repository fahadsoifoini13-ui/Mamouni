const APP_VERSION="vdef-final-4";
const DB_NAME="mamouni-v1", DB_VERSION=2;
let db, state={recipes:[],stock:[],meals:[],shopping:[],cakes:[]}, currentView="home", recipeFilter="all";

const seedRecipes=[
 {id:"r1",name:"Poulet curry",icon:"🍛",prep:15,cook:25,portions:2,category:"Plat",ingredients:[["Poulet",0.4,"kg"],["Riz",0.2,"kg"],["Oignon",1,"unit"],["Lait de coco",40,"cl"],["Curry",0.01,"kg"]],steps:["Émincer l’oignon et couper le poulet.","Faire revenir l’oignon puis ajouter le poulet.","Ajouter curry et lait de coco.","Laisser mijoter puis servir avec le riz."]},
 {id:"r2",name:"Pâtes carbonara",icon:"🍝",prep:10,cook:15,portions:2,category:"Plat",ingredients:[["Spaghetti",0.25,"kg"],["Œufs",2,"unit"],["Lardons",0.2,"kg"],["Parmesan",0.05,"kg"]],steps:["Cuire les pâtes.","Faire revenir les lardons.","Mélanger œufs et parmesan.","Mélanger hors du feu avec les pâtes."]},
 {id:"r3",name:"Quiche lorraine",icon:"🥧",prep:15,cook:35,portions:4,category:"Plat",ingredients:[["Pâte brisée",1,"unit"],["Œufs",3,"unit"],["Crème",20,"cl"],["Lardons",0.2,"kg"],["Fromage râpé",0.1,"kg"]],steps:["Préchauffer le four.","Garnir le moule avec la pâte.","Mélanger œufs et crème, ajouter les lardons.","Verser et cuire jusqu’à doré."]},
 {id:"r4",name:"Soupe carottes & pommes de terre",icon:"🥕",prep:10,cook:30,portions:4,category:"Soupe",ingredients:[["Carottes",5,"unit"],["Pommes de terre",0.6,"kg"],["Oignon",1,"unit"],["Eau",1,"L"]],steps:["Éplucher et couper les légumes.","Faire revenir l’oignon.","Ajouter légumes et eau.","Cuire puis mixer."]},
 {id:"r5",name:"Gâteau aux pommes",icon:"🍎",prep:15,cook:40,portions:6,category:"Dessert",ingredients:[["Pommes",3,"unit"],["Farine",0.2,"kg"],["Œufs",3,"unit"],["Sucre",0.12,"kg"],["Beurre",0.1,"kg"],["Lait",15,"cl"]],steps:["Préchauffer le four.","Mélanger les ingrédients.","Ajouter les pommes.","Cuire environ 40 minutes."]}
];
const seedCakes=[
 {id:"cake1",name:"Gâteau aux pommes",icon:"🍎",portions:6,ingredients:[["Pommes",3,"unit"],["Farine",0.2,"kg"],["Œufs",3,"unit"],["Sucre",0.12,"kg"],["Beurre",0.1,"kg"],["Lait",15,"cl"]],status:"planned"},
 {id:"cake2",name:"Moelleux au chocolat",icon:"🍫",portions:6,ingredients:[["Farine",0.15,"kg"],["Œufs",3,"unit"],["Sucre",0.12,"kg"],["Beurre",0.12,"kg"],["Chocolat",0.15,"kg"]],status:"planned"}
];

const seedStock=[["Poulet",1.2,"kg"],["Riz",1.0,"kg"],["Oignon",5,"unit"],["Lait de coco",40,"cl"],["Curry",0.02,"kg"],["Spaghetti",0.5,"kg"],["Œufs",6,"unit"],["Lardons",0.2,"kg"],["Parmesan",0.05,"kg"],["Pâte brisée",1,"unit"],["Crème",20,"cl"],["Fromage râpé",0.1,"kg"],["Carottes",6,"unit"],["Pommes de terre",1,"kg"],["Eau",2,"L"],["Pommes",4,"unit"],["Farine",0.5,"kg"],["Sucre",0.3,"kg"],["Beurre",0.2,"kg"],["Lait",1,"L"]].map((x,i)=>({id:"s"+i,name:x[0],qty:x[1],unit:x[2]}));

function openDB(){return new Promise((res,rej)=>{
  let settled=false;
  let timer=null;
  const finish=(fn,v)=>{if(settled)return;settled=true;if(timer)clearTimeout(timer);fn(v)};
  if(!window.indexedDB){return finish(rej,new Error("IndexedDB n’est pas disponible dans ce navigateur ou ce mode de navigation."))}
  let r;
  try{r=indexedDB.open(DB_NAME,DB_VERSION)}catch(e){return finish(rej,e)}
  timer=setTimeout(()=>finish(rej,new Error("La base locale met trop de temps à s'ouvrir. Fermez les autres onglets Matbakh puis rechargez la page.")),3500);
  r.onupgradeneeded=()=>{db=r.result;["recipes","stock","meals","shopping","cakes"].forEach(s=>{if(!db.objectStoreNames.contains(s))db.createObjectStore(s,{keyPath:"id"})})};
  r.onsuccess=()=>{db=r.result;db.onversionchange=()=>db.close();finish(res,db)};
  r.onerror=()=>finish(rej,r.error||new Error("Impossible d'ouvrir la base locale."));
  r.onblocked=()=>finish(rej,new Error("La base locale est utilisée par une autre fenêtre. Fermez les autres onglets de Matbakh puis rechargez."));
})}
function tx(store,mode="readonly"){return db.transaction(store,mode).objectStore(store)}
function getAll(store){return new Promise((res,rej)=>{const r=tx(store).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function put(store,obj){return new Promise((res,rej)=>{const r=tx(store,"readwrite").put(obj);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function del(store,id){return new Promise((res,rej)=>{const r=tx(store,"readwrite").delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}

async function normalizeStoredData(){
  // Normalise les anciens kg/cl/L et fusionne les variantes d'écriture.
  const stock=await getAll("stock"), merged=new Map();
  for(const s of stock){
    const name=canonicalIngredient(s.name), base=unitBase(name,s.qty,s.unit), key=normalize(name)+"|"+base.unit;
    if(!merged.has(key)) merged.set(key,{...s,name,qty:base.q,unit:base.unit,category:s.category||stockCategory(name).category,subcategory:s.subcategory||stockCategory(name).subcategory});
    else { const x=merged.get(key); x.qty+=base.q; await del("stock",s.id); }
  }
  for(const x of merged.values()) await put("stock",x);
  const recipes=await getAll("recipes");
  for(const r of recipes){r.ingredients=(r.ingredients||[]).map(([name,q,u])=>{const n=canonicalIngredient(name),b=unitBase(n,q,u);return [n,b.q,b.unit]});await put("recipes",r)}
  const cakes=await getAll("cakes");
  for(const c of cakes){c.ingredients=(c.ingredients||[]).map(([name,q,u])=>{const n=canonicalIngredient(name),b=unitBase(n,q,u);return [n,b.q,b.unit]});await put("cakes",c)}
}

async function seed(){
 let rs=await getAll("recipes"),ss=await getAll("stock"),cs=await getAll("cakes");
 if(!rs.length)for(const r of seedRecipes)await put("recipes",r);
 if(!ss.length)for(const s of seedStock)await put("stock",s);
 if(!cs.length)for(const c of seedCakes)await put("cakes",c);
 state.recipes=await getAll("recipes");state.stock=await getAll("stock"); for(const s of state.stock){if(!s.category){const c=stockCategory(s.name);s.category=c.category;s.subcategory=c.subcategory;await put("stock",s)}}state.meals=await getAll("meals");state.shopping=await getAll("shopping");state.cakes=await getAll("cakes");
 const currentCakeMonth=monthKey(new Date());
 for(const c of state.cakes){if(!c.month){c.month=currentCakeMonth;await put("cakes",c)}}
 state.cakes=await getAll("cakes");
 await normalizeStoredData();
 state.recipes=await getAll("recipes");state.stock=await getAll("stock");state.cakes=await getAll("cakes");
 if(!state.meals.length){await generateMonthMeals();state.meals=await getAll("meals")}
}
function normalize(s){return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim()}

let UNIT_WEIGHT_G = {"Pommes de terre":150};
try{const saved=JSON.parse(localStorage.getItem("matbakh-unit-weights")||"{}");if(Number(saved.potato)>0)UNIT_WEIGHT_G["Pommes de terre"]=Number(saved.potato)}catch{}
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

async function generateMonthMeals(){
 const now=new Date(),y=now.getFullYear(),m=now.getMonth(),recipes=state.recipes.length?state.recipes:await getAll("recipes");
 if(!recipes.length)return;
 for(let d=1;d<=new Date(y,m+1,0).getDate();d++)for(const slot of ["midi","soir"]){
  const r=recipes[(d+(slot==="soir"?1:0))%recipes.length];
  await put("meals",{id:`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}-${slot}`,date:`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`,slot,recipeId:r.id,status:"planned"});
 }
}

async function rebuildShopping(){
 const today=dateKey(new Date());
 const future=state.meals.filter(m=>m.status==="planned" && m.date>=today);
 const need={};
 for(const m of future){
   const r=recipeById(m.recipeId); if(!r)continue;
   for(const [name,q,u] of r.ingredients){const n=canonicalIngredient(name),b=quantityFor(n,q,u),k=normalize(n);if(!need[k])need[k]={name:n,qty:0,unit:b.unit,category:stockCategory(n).category,source:"repas"};need[k].qty+=b.q}
 }
 for(const c of (state.cakes||[]).filter(c=>c.status==="planned")){
   for(const [name,q,u] of c.ingredients){const n=canonicalIngredient(name),b=quantityFor(n,q,u),k=normalize(n);if(!need[k])need[k]={name:n,qty:0,unit:b.unit,category:stockCategory(n).category,source:"gateaux"};need[k].qty+=b.q}
 }
 const current=state.shopping;
 for(const x of current) if(x.type!=="other") await del("shopping",x.id);
 for(const k in need){
   const n=need[k],st=findStock(n.name),short=Math.max(0,n.qty-(st?st.qty:0));
   if(short>1e-9) await put("shopping",{id:"c"+k,name:n.name,qty:short,unit:n.unit,checked:false,type:"food",category:n.category});
 }
 state.shopping=await getAll("shopping");
}
async function addMissing(items){
 const list=Array.isArray(items)?items:[];
 if(!list.length)return;
 const existing=await getAll("shopping");
 for(const x of list){
  const name=canonicalIngredient(x.name),id="c"+normalize(name),found=existing.find(s=>s.id===id);
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
 document.getElementById("home").innerHTML=`<div class="hero"><div class="hero-emoji">🏠</div><h1>مَطْبَخ</h1><p class="muted">Votre carnet de cuisine, simplement.</p><div class="stat-row"><div class="stat"><strong>${planned}</strong><span class="small">repas restants</span></div><div class="stat"><strong>${state.recipes.length}</strong><span class="small">recettes</span></div><div class="stat"><strong>${state.shopping.length}</strong><span class="small">courses</span></div></div></div><div class="section-title"><h2>Aujourd'hui</h2><span class="meta">${new Date().toLocaleDateString("fr-FR",{day:"numeric",month:"long"})}</span></div><div class="grid">${todays.length?todays.map(mealHomeCard).join(""):`<div class="card empty">Aucun repas planifié aujourd'hui.</div>`}</div><div class="section-title"><h2>⚠️ À surveiller</h2><button class="btn ghost" onclick="setView('stock')">Voir le stock</button></div><div class="card">${low.length?`<div class="list">${low.slice(0,5).map(s=>`<div class="row"><span>${esc(s.name)}</span><span class="quantity">${fmt(s.qty,s.unit)}</span></div>`).join("")}</div>`:`<div class="empty">Votre stock ne présente pas de niveau faible.</div>`}</div><div class="section-title"><h2>🛒 Courses</h2><button class="btn ghost" onclick="setView('shopping')">Voir la liste</button></div><div class="card">${state.shopping.length?`<div class="list">${state.shopping.slice(0,5).map(s=>`<div class="row"><span>${esc(s.name)}</span><b>${s.type==="other"?esc(s.qtyText||"1"):fmt(s.qty,s.unit)}</b></div>`).join("")}</div>`:`<div class="empty">Aucun achat nécessaire pour le moment ♡</div>`}</div>`;
}
function mealHomeCard(m){const r=recipeById(m.recipeId);if(!r)return"";const a=availability(r);return `<div class="card meal-slot"><span>${m.slot==="midi"?"☀️":"🌙"}</span><button onclick="openRecipe('${r.id}')">${esc(r.name)}<div class="meta">${m.status==="done"?"✅ Réalisé":a.ok?"🟢 Tout est disponible":`🔴 ${a.missing.length} ingrédient(s) manquant(s)`}</div></button><button class="btn secondary" onclick="cookByMeal('${m.id}')">${m.status==="done"?"↶ Annuler":"Cuisiner"}</button></div>`}

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
 const cakeCards=cakes.map(c=>{const a=cakeAvailability(c);return `<article class="cake-card"><div class="cake-card-icon">${c.icon||"🍰"}</div><div class="cake-card-body"><b>${esc(c.name)}</b><div class="meta">${c.portions} pers. · ${c.status==="done"?"✅ Réalisé":"📅 Prévu"}</div><div class="small ${a.ok?"cake-ok":"cake-missing"}">${a.ok?"🟢 Ingrédients disponibles":`🔴 manque ${a.missing.length}`}</div></div><div class="cake-card-actions"><button class="pill" onclick="editCake('${c.id}')">Modifier</button>${c.status==="planned"?`<button class="btn secondary" ${a.ok?"":"disabled"} onclick="cookCake('${c.id}')">Faire</button>`:`<button class="pill" onclick="undoCake('${c.id}')">Annuler</button>`}</div></article>`}).join("");
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
   if(!meal)return `<div class="day-detail-row"><div><b>${slot==="midi"?"☀️ Midi":"🌙 Soir"}</b><div class="meta">${past?"Journée passée":"Aucun repas prévu"}</div></div>${past?"":`<button class="btn secondary" onclick="closeModal();openMealPlanner('${date}','${slot}')">＋ Ajouter</button>`}</div>`;
   const r=recipeById(meal.recipeId),a=availability(r);
   return `<div class="day-detail-row"><div><b>${slot==="midi"?"☀️ Midi":"🌙 Soir"} · ${esc(r.name)}</b><div class="meta">${past?"🕰️ Journée passée · ":""}${meal.status==="done"?"✅ Réalisé":a.ok?"🟢 Disponible":"🔴 Ingrédients manquants"}</div></div><div class="actions">${past?`<button class="pill" onclick="closeModal();openRecipe('${r.id}')">Voir</button>`:`${meal.status==="planned"?`<button class="pill" onclick="closeModal();openRecipe('${r.id}')">Voir</button><button class="pill" onclick="closeModal();openMealPlanner('${date}','${slot}')">↔ Remplacer</button><button class="btn secondary" onclick="closeModal();cookByMeal('${meal.id}')">Cuisiner</button>`:`<button class="pill" onclick="closeModal();undoCookMeal('${meal.id}')">↶ Annuler</button>`}`}</div></div>`;
 }).join("");
 showModal(`<button class="close" onclick="closeModal()">×</button><div class="section-emoji">📅</div><h2>${title}</h2>${past?`<p class="muted">Cette journée est passée et n'entre plus dans le calcul des repas restants ni dans la liste de courses.</p>`:""}<div class="list">${rows}</div>${past?"":`<div class="actions"><button class="btn ghost full" onclick="closeModal();openMealPlanner('${date}','midi')">＋ Ajouter / remplacer un repas</button></div>`}`);
}
function renderRecipes(){const q=(document.getElementById("recipeSearch")?.value||"").toLowerCase();let rs=state.recipes.filter(r=>r.name.toLowerCase().includes(q)||r.category.toLowerCase().includes(q));if(recipeFilter==="available")rs=rs.filter(r=>availability(r).ok);if(recipeFilter==="missing")rs=rs.filter(r=>!availability(r).ok);document.getElementById("recipes").innerHTML=`<div class="section-title"><div><div class="section-emoji">🍳</div><h1>Mes recettes</h1></div><button class="btn" onclick="newRecipe()">+ Ajouter</button></div><input id="recipeSearch" class="search" placeholder="Rechercher une recette..." value="${esc(q)}" oninput="renderRecipes()"><div class="filters"><button class="pill ${recipeFilter==="all"?"active":""}" onclick="recipeFilter='all';renderRecipes()">Toutes</button><button class="pill ${recipeFilter==="available"?"active":""}" onclick="recipeFilter='available';renderRecipes()">Disponibles</button><button class="pill ${recipeFilter==="missing"?"active":""}" onclick="recipeFilter='missing';renderRecipes()">Indisponibles</button></div><div class="grid grid-2">${rs.map(recipeCard).join("")||`<div class="card empty">Aucune recette trouvée.</div>`}</div>`}
function recipeCard(r){const a=availability(r);return `<article class="card recipe-card ${a.ok?"":"disabled"}"><div class="recipe-head"><div class="recipe-icon">${r.icon||"🍽️"}</div><div style="flex:1"><h3>${esc(r.name)}</h3><div class="meta">${r.category} · ${r.prep+r.cook} min · ${r.portions} pers.</div><div style="margin-top:8px"><span class="badge ${a.ok?"ok":"bad"}">${a.ok?"✓ Disponible":`⚠ ${a.pct}% disponible`}</span></div></div></div>${!a.ok?`<div class="small muted" style="margin-top:9px">Manque : ${a.missing.slice(0,3).map(x=>`${esc(x.name)} (${fmt(x.shortage,x.unit)})`).join(" · ")}</div>`:""}<div class="actions"><button class="btn ${a.ok?"":"secondary"}" onclick="openRecipe('${r.id}')">Voir la recette</button><button class="pill" onclick="editRecipe('${r.id}')">Modifier</button>${a.ok?`<button class="btn secondary" onclick="quickCook('${r.id}')">J'ai cuisiné</button>`:""}</div></article>`}

function lowThreshold(s){return s.unit==="unit"?2:s.unit==="g"?200:s.unit==="ml"?200:10}
function renderStock(){
 const order=["Fruits & légumes","Secs","Conserves","Frais","Boucherie","Surgeles","Autres"];
 const cats={};state.stock.forEach(x=>{const c=x.category||stockCategory(x.name).category;(cats[c]??=[]).push(x)});
 const html=order.filter(c=>cats[c]?.length).map(c=>{const subs={};cats[c].forEach(x=>(subs[x.subcategory||""]??=[]).push(x));return `<div class="section-title"><h2>${c}</h2></div><div class="card">${Object.entries(subs).map(([sub,arr])=>`${sub?`<h4 class="stock-subcategory">${esc(sub)}</h4>`:""}<div class="list">${arr.map(x=>`<div class="row"><div><b>${esc(x.name)}</b><div class="meta">${x.qty<=lowThreshold(x)?"⚠️ Niveau faible":"Stock actuel"}</div></div><div style="display:flex;align-items:center;gap:8px"><span class="quantity">${fmt(x.qty,x.unit)}</span><button class="pill" onclick="editStock('${x.id}')">Modifier</button></div></div>`).join("")}</div>`).join("")}</div>`}).join("");
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
 const foodHtml=Object.entries(grouped).map(([cat,items])=>`<div class="shopping-category"><h3>${cat}</h3><div class="list">${items.map(s=>`<div class="row shopping-row"><label style="display:flex;align-items:center;gap:10px;flex:1;min-width:0"><input class="check" type="checkbox" ${s.checked?"checked":""} onchange="toggleShopping('${s.id}',this.checked)"><span><b>${esc(s.name)}</b><div class="meta">À acheter</div></span></label><label class="purchase-field"><span class="small">${fmt(s.qty,s.unit)}</span><input id="buy-${s.id}" type="number" min="0" max="${s.qty}" step="0.001" value="${s.qty}" inputmode="decimal"><span class="small">${esc(s.unit)}</span></label></div>`).join("")}</div></div>`).join("");
 const otherHtml=Object.entries(otherGrouped).map(([cat,items])=>`<div class="shopping-category"><h3>🛍️ ${esc(cat)}</h3><div class="list">${items.map(s=>`<div class="row"><label style="display:flex;align-items:center;gap:10px;flex:1"><input class="check" type="checkbox" ${s.checked?"checked":""} onchange="toggleOtherShopping('${s.id}',this.checked)"><span style="${s.checked?"text-decoration:line-through;opacity:.5":""}"><b>${esc(s.name)}</b><div class="meta">${esc(s.qtyText||"")}</div></span></label><button class="pill" onclick="deleteShopping('${s.id}')">×</button></div>`).join("")}</div></div>`).join("");
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
 const existing=state.meals.find(m=>m.date===date&&m.slot===slot),options=state.recipes.map(r=>`<option value="${r.id}" ${existing?.recipeId===r.id?"selected":""}>${esc(r.name)}</option>`).join("");
 showModal(`<button class="close" onclick="closeModal()">×</button><h2>${existing?"Modifier":"Ajouter"} un repas ♡</h2><p class="muted">Choisissez librement le jour, le créneau et la recette. Si un repas existe déjà, il sera remplacé.</p><form class="form" id="mealForm"><label>Date<input name="date" type="date" required value="${date}"></label><label>Créneau<select name="slot"><option value="midi" ${slot==="midi"?"selected":""}>☀️ Midi</option><option value="soir" ${slot==="soir"?"selected":""}>🌙 Soir</option></select></label><label>Recette<select name="recipe" required>${options}</select></label><button class="btn full">${existing?"Remplacer le repas":"Ajouter le repas"}</button>${existing?`<button type="button" class="btn ghost full" onclick="removeMeal('${existing.id}')">Supprimer ce repas</button>`:""}</form>`);
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

function openRecipe(id){const r=recipeById(id),a=availability(r);showModal(`<button class="close" onclick="closeModal()">×</button><div class="recipe-head"><div class="recipe-icon">${r.icon||"🍽️"}</div><div><h2>${esc(r.name)}</h2><div class="meta">${r.category} · préparation ${r.prep} min · cuisson ${r.cook} min · ${r.portions} personnes</div></div></div><div class="section-title"><h3>Ingrédients</h3><span class="badge ${a.ok?"ok":"bad"}">${a.ok?"Tout est disponible":`${a.pct}% disponible`}</span></div><div class="card"><div class="list">${r.ingredients.map(([n,q,u])=>{const need=quantityFor(n,q,u),s=findStock(n),have=s?unitBase(n,s.qty,s.unit).q:0,ok=have>=need.q;return `<div class="row"><span>${esc(canonicalIngredient(n))}</span><span><b>${fmt(q,u)}</b> <span class="small">${ok?"🟢":"🔴 "+fmt(Math.max(0,need.q-have),need.unit)+" manquant"}</span></span></div>`}).join("")}</div></div><div class="section-title"><h3>Préparation</h3></div><div class="card"><ol>${r.steps.map(x=>`<li style="margin:9px 0">${esc(x)}</li>`).join("")}</ol></div><div class="actions"><button class="btn secondary full" onclick="closeModal();editRecipe('${r.id}')">✎ Modifier la recette</button>${a.ok?`<button class="btn full" onclick="closeModal();quickCook('${r.id}')">✓ J'ai cuisiné</button>`:`<button class="btn full" id="recipeMissingBtn">🛒 Ajouter les manquants aux courses</button>`}</div>`);if(!a.ok)document.getElementById("recipeMissingBtn").onclick=async()=>{await addMissing(a.missing);closeModal()}}

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
 showModal(`<button class="close" onclick="closeModal()">×</button><h2>${s?"Modifier":"Ajouter"} un stock</h2><form class="form" id="stockForm"><label>Ingrédient<input name="name" required value="${s?esc(s.name):""}" placeholder="Ex. Tomates"></label><label>Catégorie<select name="category"><option>Fruits & légumes</option><option>Secs</option><option>Conserves</option><option>Frais</option><option>Boucherie</option><option>Surgeles</option><option>Autres</option></select></label><label>Sous-catégorie (pour les secs)<select name="subcategory"><option value="">—</option><option>Sucré</option><option>Salé</option><option>Épices</option></select></label><div class="grid grid-2"><label>Quantité<input name="qty" type="number" step="0.001" min="0" required value="${s?s.qty:""}"></label><label>Unité<select name="unit"><option value="g" ${s?.unit==="g"||s?.unit==="kg"?"selected":""}>g</option><option value="ml" ${s?.unit==="ml"||s?.unit==="cl"||s?.unit==="L"?"selected":""}>ml</option><option value="unit" ${s?.unit==="unit"?"selected":""}>unité</option></select></label></div><button class="btn full">Enregistrer</button>${s?`<button type="button" class="btn ghost full" onclick="deleteStock('${s.id}')">Supprimer</button>`:""}</form>`);
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

async function regenerateMonth(){if(!confirm("Recréer les repas de démonstration du mois ? Les repas déjà réalisés seront conservés."))return;const done=state.meals.filter(m=>m.status==="done");for(const m of state.meals)if(m.status!=="done")await del("meals",m.id);state.meals=done;await generateMonthMeals();state.meals=await getAll("meals");await rebuildShopping();render();showToast("✓ Planning recalculé")}
function setView(v){currentView=v;render()}
async function exportBackup(){
  const payload={
    format:"matbakh-backup",
    version:1,
    appVersion:APP_VERSION,
    exportedAt:new Date().toISOString(),
    dbName:DB_NAME,
    stores:{
      recipes:await getAll("recipes"),
      stock:await getAll("stock"),
      meals:await getAll("meals"),
      shopping:await getAll("shopping"),
      cakes:await getAll("cakes")
    },
    settings:{
      season:localStorage.getItem("matbakh-season")||null,
      unitWeights:localStorage.getItem("matbakh-unit-weights")||null
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
    const text=await file.text(),payload=JSON.parse(text);
    if(payload?.format!=="matbakh-backup" || !payload?.stores)throw new Error("Ce fichier n’est pas une sauvegarde Matbakh valide.");
    const stores=["recipes","stock","meals","shopping","cakes"];
    const counts=Object.fromEntries(stores.map(k=>[k,Array.isArray(payload.stores[k])?payload.stores[k].length:0]));
    const total=Object.values(counts).reduce((a,b)=>a+b,0);
    if(!total)throw new Error("La sauvegarde ne contient aucune donnée.");
    if(!confirm(`Importer cette sauvegarde ?\n\nRecettes : ${counts.recipes}\nStock : ${counts.stock}\nRepas : ${counts.meals}\nCourses : ${counts.shopping}\nGâteaux : ${counts.cakes}\n\nLes données locales actuelles de cette version seront remplacées.`))return;
    // Backup the current local state first, so an accidental import never becomes irreversible.
    try{localStorage.setItem("matbakh-pre-import-backup",JSON.stringify({at:new Date().toISOString(),stores:Object.fromEntries(await Promise.all(stores.map(async k=>[k,await getAll(k)]))),settings:{season:localStorage.getItem("matbakh-season")||null,unitWeights:localStorage.getItem("matbakh-unit-weights")||null}}));}catch{}
    for(const store of stores){
      const existing=await getAll(store);
      for(const row of existing)await del(store,row.id);
      for(const row of (Array.isArray(payload.stores[store])?payload.stores[store]:[])){
        if(row && row.id!=null)await put(store,row);
      }
    }
    if(payload.settings?.season)localStorage.setItem("matbakh-season",payload.settings.season);else localStorage.removeItem("matbakh-season");
    if(payload.settings?.unitWeights)localStorage.setItem("matbakh-unit-weights",payload.settings.unitWeights);else localStorage.removeItem("matbakh-unit-weights");
    state.recipes=await getAll("recipes");state.stock=await getAll("stock");state.meals=await getAll("meals");state.shopping=await getAll("shopping");state.cakes=await getAll("cakes");
    await normalizeStoredData();
    state.recipes=await getAll("recipes");state.stock=await getAll("stock");state.meals=await getAll("meals");state.shopping=await getAll("shopping");state.cakes=await getAll("cakes");
    await rebuildShopping();render();closeModal();showToast(`✓ Données restaurées — ${state.recipes.length} recettes`);
  }catch(e){showToast(`⚠️ ${e?.message||"Import impossible"}`)}
}
function showDataManager(){
  showModal(`<button class="close" onclick="closeModal()">×</button><div class="section-emoji">💾</div><h2>Mes données</h2><p class="muted">Sur iPhone, Safari et une app ajoutée à l’écran d’accueil peuvent avoir des stockages locaux séparés. Cette sauvegarde permet de transférer toutes les données sans les ressaisir.</p><div class="card"><b>⬆️ Exporter une sauvegarde</b><p class="muted small">Recettes, stock, repas, courses et gâteaux. Sur iPhone, choisissez ensuite « Enregistrer dans Fichiers » ou envoyez le fichier vers l’autre appareil/app.</p><button class="btn full" onclick="exportBackup()">Exporter mes données</button></div><div class="card"><b>⬇️ Restaurer une sauvegarde</b><p class="muted small">Utilisez le fichier JSON exporté depuis Safari pour récupérer vos données dans l’app installée.</p><button class="btn secondary full" onclick="pickBackup()">Importer mes données</button><input id="backupFileInput" type="file" accept="application/json,.json" hidden onchange="importBackup(this.files?.[0]);this.value=''"/></div><div class="card"><b>🛡️ Conseil</b><p class="muted small">Faites une exportation avant une grosse mise à jour. La sauvegarde reste indépendante de l’URL et de la version de l’application.</p></div><div class="card"><b>⚠️ Zone de test</b><p class="muted small">La réinitialisation supprime uniquement les données locales de cette app et recharge les données de démonstration.</p><button class="btn ghost full" onclick="resetDemoData()">Réinitialiser les données de démonstration</button></div>`);
}

function showConverter(){
 showModal(`<button class="close" onclick="closeModal()">×</button><div class="section-emoji">↔</div><h2>Convertisseur</h2><p class="muted">Convertissez instantanément les unités de cuisine les plus courantes.</p><div class="converter-grid"><label>Valeur<input id="convValue" type="number" step="0.001" value="1" oninput="runConverter()"></label><label>De<select id="convFrom" onchange="runConverter()"><option value="kg">kg</option><option value="g">g</option><option value="L">L</option><option value="cl">cl</option><option value="ml">ml</option></select></label><label>Vers<select id="convTo" onchange="runConverter()"><option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="cl">cl</option><option value="L">L</option></select></label></div><div id="convResult" class="converter-result">1 kg = 1 000 g</div><div class="card converter-note"><b>🥔 Pommes de terre</b><div class="muted">1 pdt ≈ ${UNIT_WEIGHT_G["Pommes de terre"]} g pour relier les recettes en unités au stock en grammes.</div><div class="actions"><button class="pill" onclick="changePotatoWeight()">Modifier le poids moyen</button></div></div>`);
 runConverter();
}
function convertSimple(q,from,to){const factors={g:1,kg:1000,ml:1,cl:10,L:1000};const groups={g:"weight",kg:"weight",ml:"volume",cl:"volume",L:"volume"};if(groups[from]!==groups[to])return null;return Number(q)*factors[from]/factors[to]}
function runConverter(){const q=Number(document.getElementById("convValue")?.value||0),from=document.getElementById("convFrom")?.value,to=document.getElementById("convTo")?.value,out=document.getElementById("convResult");if(!out)return;const v=convertSimple(q,from,to);out.textContent=v===null?"Conversion impossible entre ces unités":""+trim(q)+" "+from+" = "+trim(v)+" "+to}
function changePotatoWeight(){const current=UNIT_WEIGHT_G["Pommes de terre"];showModal(`<button class="close" onclick="showConverter()">×</button><h2>Poids moyen d’une pomme de terre 🥔</h2><p class="muted">Cette valeur permet à Mamouni de convertir automatiquement « 8 pdt » en grammes dans le stock.</p><label class="form">1 pomme de terre<input id="potatoWeight" type="number" min="1" step="1" value="${current}"> g</label><button class="btn full" onclick="savePotatoWeight()">Enregistrer</button>`)}
function savePotatoWeight(){const v=Number(document.getElementById("potatoWeight")?.value);if(!Number.isFinite(v)||v<=0)return;UNIT_WEIGHT_G["Pommes de terre"]=v;localStorage.setItem("matbakh-unit-weights",JSON.stringify({potato:v}));closeModal();showConverter();showToast("✓ Poids moyen des pommes de terre mis à jour")}
function autoSeason(){const m=new Date().getMonth()+1;return m>=3&&m<=5?"spring":m>=6&&m<=8?"summer":m>=9&&m<=11?"autumn":"winter"}
function applySeason(theme){document.body.dataset.season=theme;localStorage.setItem("matbakh-season",theme)}
function showSeasonPicker(){const current=document.body.dataset.season||autoSeason();showModal(`<button class="close" onclick="closeModal()">×</button><div class="section-emoji">🌿</div><h2>Ambiance saisonnière</h2><p class="muted">Une base moderne avec une petite touche vintage, adaptée à la saison.</p><div class="season-options"><button class="season-option ${current==="spring"?"active":""}" onclick="applySeason('spring');closeModal();render()">🌸 Printemps</button><button class="season-option ${current==="summer"?"active":""}" onclick="applySeason('summer');closeModal();render()">☀️ Été</button><button class="season-option ${current==="autumn"?"active":""}" onclick="applySeason('autumn');closeModal();render()">🍂 Automne</button><button class="season-option ${current==="winter"?"active":""}" onclick="applySeason('winter');closeModal();render()">❄️ Hiver</button></div><button class="btn ghost full" onclick="localStorage.removeItem('matbakh-season');applySeason(autoSeason());closeModal();render()">↻ Suivre automatiquement la saison</button>`)}

function showModal(html){document.getElementById("modalRoot").innerHTML=`<div class="modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="modal">${html}</div></div>`}
function closeModal(){document.getElementById("modalRoot").innerHTML=""}
let toastTimer;function showToast(t){clearTimeout(toastTimer);const x=document.createElement("div");x.textContent=t;x.style="position:fixed;z-index:100;left:50%;bottom:92px;transform:translateX(-50%);background:#5d4a43;color:white;padding:12px 16px;border-radius:999px;box-shadow:0 8px 25px #0002;font-size:13px;max-width:90vw;text-align:center";document.body.appendChild(x);toastTimer=setTimeout(()=>x.remove(),2600)}

document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>setView(b.dataset.view));
async function resetDemoData(){if(confirm("Réinitialiser Matbakh avec les données de démonstration ? Toutes les données locales seront supprimées.")){closeModal();try{db?.close()}catch{};indexedDB.deleteDatabase(DB_NAME);location.reload()}}
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
   const minDuration=850,wait=Math.max(0,minDuration-(performance.now()-splashStart));
   setTimeout(()=>splash?.classList.add("is-hidden"),wait);
 };
 try{
   applySeason(localStorage.getItem("matbakh-season")||autoSeason());
   await openDB();try{await navigator.storage?.persist?.()}catch{};await seed();await rebuildShopping();render();
   window.__matbakhBootFinished=true;
   if("serviceWorker" in navigator&&location.protocol!=="file:")navigator.serviceWorker.register("sw.js?v=vdef-final-4",{updateViaCache:"none"}).catch(()=>{});
   finishSplash();
 }catch(e){
   window.__matbakhBootFinished=true;
   document.getElementById("main").innerHTML=`<div class="card empty"><h2>Impossible de charger Matbakh</h2><p class="muted">${esc(e.message||"Erreur inconnue")}</p><button class="btn" onclick="location.reload()">Recharger</button></div>`;
   finishSplash();
 }
})();
