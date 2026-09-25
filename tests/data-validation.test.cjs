const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { validateBackup } = require("../app/data-validation.js");

function validBackup() {
  return {
    format: "matbakh-backup",
    version: 1,
    appVersion: "vdef-final-4",
    exportedAt: "2026-09-25T10:00:00.000Z",
    dbName: "mamouni-v1",
    stores: {
      recipes: [{ id: "r-test", name: "Soupe test", icon: "🥣", prep: 10, cook: 20, portions: 2, category: "Soupe", ingredients: [["Carotte", 2, "unit"]], steps: ["Préparer"] }],
      stock: [{ id: "s-test", name: "Carotte", qty: 4, unit: "unit", category: "Fruits & légumes", subcategory: "" }],
      meals: [{ id: "2026-09-25-midi", date: "2026-09-25", slot: "midi", recipeId: "r-test", status: "planned" }],
      shopping: [{ id: "c-test", name: "Carotte", qty: 1, unit: "unit", checked: false, type: "food", category: "Fruits & légumes" }],
      cakes: [{ id: "cake-test", name: "Gâteau test", icon: "🍰", portions: 4, ingredients: [["Farine", 100, "g"]], status: "planned", month: "2026-09" }]
    },
    settings: { season: "autumn", specialEvent: null, unitWeights: null }
  };
}

test("valide un export complet et cohérent", () => {
  const checked = validateBackup(validBackup());
  assert.deepEqual(checked.counts, { recipes: 1, stock: 1, meals: 1, shopping: 1, cakes: 1 });
});

test("accepte cinq stores présents mais vides", () => {
  const backup = validBackup();
  for (const rows of Object.values(backup.stores)) rows.length = 0;
  assert.deepEqual(validateBackup(backup).counts, { recipes: 0, stock: 0, meals: 0, shopping: 0, cakes: 0 });
});

test("refuse le JSON racine invalide, le format ou la version inconnue", () => {
  assert.throws(() => validateBackup(null), /racine JSON/);
  const backup = validBackup();
  backup.version = 99;
  assert.throws(() => validateBackup(backup), /version/);
});

test("refuse les métadonnées de sauvegarde absentes ou invalides", () => {
  const backup = validBackup();
  delete backup.exportedAt;
  assert.throws(() => validateBackup(backup), /exportedAt/);
  backup.exportedAt = "2026-09-25T10:00:00.000Z";
  backup.dbName = "";
  assert.throws(() => validateBackup(backup), /dbName/);
});

test("refuse un store manquant ou non tabulaire avant toute écriture", () => {
  const backup = validBackup();
  delete backup.stores.cakes;
  assert.throws(() => validateBackup(backup), /stores.cakes/);
});

test("refuse les champs requis invalides et les identifiants dupliqués", () => {
  const backup = validBackup();
  backup.stores.stock[0].qty = Infinity;
  backup.stores.recipes.push({ ...backup.stores.recipes[0] });
  assert.throws(() => validateBackup(backup), /qty|identifiant dupliqué/);
});

test("refuse les identifiants pouvant sortir des gestionnaires de clic HTML", () => {
  const backup = validBackup();
  backup.stores.recipes[0].id = "x');alert(1);//";
  assert.throws(() => validateBackup(backup), /identifiant texte obligatoire/);
});

test("refuse une référence de recette cassée, une date et une unité invalides", () => {
  const backup = validBackup();
  backup.stores.meals[0].recipeId = "absente";
  backup.stores.meals[0].date = "2026-02-31";
  backup.stores.recipes[0].ingredients[0][2] = "tasse";
  assert.throws(() => validateBackup(backup), /date invalide|aucune recette correspondante|unité non prise en charge/);
});

test("refuse deux repas sur le même créneau", () => {
  const backup = validBackup();
  backup.stores.meals.push({ ...backup.stores.meals[0], id: "meal-duplicate" });
  assert.throws(() => validateBackup(backup), /même créneau/);
});

test("valide les nouvelles préférences d'événement Halloween", () => {
  const backup = validBackup();
  backup.settings.specialEvent = "halloween";
  assert.equal(validateBackup(backup).settings.specialEvent, "halloween");
  backup.settings.specialEvent = "noel";
  assert.throws(() => validateBackup(backup), /settings.specialEvent/);
});

test("le code ne contient plus de chemin qui réinjecte les données d'exemple", () => {
  const source = fs.readFileSync(path.join(__dirname, "../app/app.js"), "utf8");
  for (const marker of ["seedRecipes", "seedStock", "seedCakes", "function seed(", "generateMonthMeals", "resetDemoData", "deleteDatabase(", "regenerateMonth("]) {
    assert.equal(source.includes(marker), false, `marqueur encore présent: ${marker}`);
  }
});

test("la mise à niveau IndexedDB est additive et le Service Worker ne touche pas aux données", () => {
  const app = fs.readFileSync(path.join(__dirname, "../app/app.js"), "utf8");
  const worker = fs.readFileSync(path.join(__dirname, "../app/sw.js"), "utf8");
  assert.match(app, /const DB_NAME="mamouni-v1", DB_VERSION=3/);
  assert.match(app, /if\(!upgrading\.objectStoreNames\.contains\(name\)\)upgrading\.createObjectStore/);
  assert.doesNotMatch(app, /deleteDatabase\s*\(/);
  assert.match(worker, /key\.startsWith\("matbakh-vdef-"\)\|\|key\.startsWith\("matbakh-v5-"\)/);
  assert.doesNotMatch(worker, /indexedDB|objectStore|\.clear\s*\(/i);
});

test("la restauration prépare un retour arrière et interrompt la transaction si la vérification échoue", () => {
  const app = fs.readFileSync(path.join(__dirname, "../app/app.js"), "utf8");
  assert.match(app, /function atomicReplaceData\(nextStores,nextSettings/);
  assert.match(app, /id:"last-import-rollback",snapshot:rollbackSnapshot/);
  assert.match(app, /store\.clear\(\)/);
  assert.match(app, /if\(!sameRows\(verification\.result,nextStores\[name\]\)\)abort/);
  assert.match(app, /transaction\.abort\(\)/);
  assert.match(app, /function inlineArg\(value\)/);
  assert.match(app, /id:"c"\+encodeURIComponent\(key\)/);
});

test("les décorations restent derrière l’interface et les animations respectent le réglage réduit", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/index.html"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "../app/styles.css"), "utf8");
  assert.match(html, /id="seasonalDecor"[\s\S]*?aria-hidden="true"/);
  assert.match(css, /\.seasonal-decor\{[^}]*pointer-events:none/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.season-art\{animation:none\}\}/);
  for (const symbol of ["leaf", "pumpkin", "mushroom", "chestnut", "candle", "ghost", "bat", "moon", "sparkle", "sun", "snowflake"]) {
    assert.ok(html.includes(`id="season-${symbol}"`), `illustration manquante: ${symbol}`);
  }
});
