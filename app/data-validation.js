/* Pure backup validation shared by the browser app and the Node test suite. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MamouniData = api;
})(typeof globalThis === "undefined" ? this : globalThis, function () {
  const STORE_NAMES = ["recipes", "stock", "meals", "shopping", "cakes"];
  const UNITS = new Set(["g", "kg", "ml", "cl", "L", "unit"]);
  const SEASONS = new Set(["spring", "summer", "autumn", "winter", "auto"]);
  const EVENTS = new Set(["halloween"]);

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function nonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0 && value.length <= 500;
  }

  function idOk(value) {
    return typeof value === "string" && value.length > 0 && value.length <= 200 && !/[<>&'"`\\\u0000-\u001f\u2028\u2029]/.test(value);
  }

  function amountOk(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
  }

  function dateOk(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }

  function monthOk(value) {
    if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
    return true;
  }

  function validateBackup(payload) {
    const errors = [];
    const fail = (path, message) => errors.push(`${path}: ${message}`);
    if (!isRecord(payload)) throw new Error("La racine JSON doit être un objet.");
    if (payload.format !== "matbakh-backup") fail("format", "format de sauvegarde inconnu.");
    if (payload.version !== 1) fail("version", "seule la version 1 est prise en charge.");
    if (!nonEmptyString(payload.appVersion)) fail("appVersion", "version de l’application obligatoire.");
    if (typeof payload.exportedAt !== "string" || Number.isNaN(Date.parse(payload.exportedAt))) fail("exportedAt", "date d’export invalide.");
    if (!nonEmptyString(payload.dbName)) fail("dbName", "nom de la base source obligatoire.");
    if (!isRecord(payload.stores)) fail("stores", "objet obligatoire manquant.");
    if (!isRecord(payload.settings)) fail("settings", "objet obligatoire manquant.");
    if (errors.length) throw new Error(errors.join("\n"));

    const stores = {};
    for (const name of STORE_NAMES) {
      const rows = payload.stores[name];
      if (!Array.isArray(rows)) {
        fail(`stores.${name}`, "la section doit être présente sous forme de tableau, même si elle est vide.");
      } else {
        stores[name] = rows;
      }
    }
    if (errors.length) throw new Error(errors.join("\n"));

    for (const name of STORE_NAMES) {
      const seenIds = new Set();
      for (const [index, row] of stores[name].entries()) {
        const path = `stores.${name}[${index}]`;
        if (!isRecord(row)) {
          fail(path, "chaque ligne doit être un objet.");
          continue;
        }
        if (!idOk(row.id)) fail(`${path}.id`, "identifiant texte obligatoire.");
        else if (seenIds.has(row.id)) fail(`${path}.id`, "identifiant dupliqué dans cette section.");
        else seenIds.add(row.id);

        if (name === "recipes") {
          for (const key of ["name", "icon", "category"]) if (!nonEmptyString(row[key])) fail(`${path}.${key}`, "texte obligatoire.");
          for (const key of ["prep", "cook"]) if (!amountOk(row[key])) fail(`${path}.${key}`, "nombre positif ou nul obligatoire.");
          if (!Number.isInteger(row.portions) || row.portions < 1) fail(`${path}.portions`, "nombre entier supérieur à zéro obligatoire.");
          validateIngredients(row.ingredients, `${path}.ingredients`, fail);
          if (!Array.isArray(row.steps) || row.steps.some(step => typeof step !== "string")) fail(`${path}.steps`, "tableau de textes obligatoire.");
        } else if (name === "stock") {
          if (!nonEmptyString(row.name)) fail(`${path}.name`, "nom obligatoire.");
          if (!amountOk(row.qty)) fail(`${path}.qty`, "quantité finie positive ou nulle obligatoire.");
          if (!UNITS.has(row.unit)) fail(`${path}.unit`, "unité non prise en charge.");
          if (row.category !== undefined && typeof row.category !== "string") fail(`${path}.category`, "texte attendu.");
          if (row.subcategory !== undefined && typeof row.subcategory !== "string") fail(`${path}.subcategory`, "texte attendu.");
        } else if (name === "meals") {
          if (!dateOk(row.date)) fail(`${path}.date`, "date invalide (AAAA-MM-JJ attendu).");
          if (row.slot !== "midi" && row.slot !== "soir") fail(`${path}.slot`, "créneau midi ou soir attendu.");
          if (!idOk(row.recipeId)) fail(`${path}.recipeId`, "identifiant de recette obligatoire.");
          if (row.status !== "planned" && row.status !== "done") fail(`${path}.status`, "statut planned ou done attendu.");
          if (row.doneAt !== undefined && (typeof row.doneAt !== "string" || Number.isNaN(Date.parse(row.doneAt)))) fail(`${path}.doneAt`, "date de réalisation invalide.");
        } else if (name === "shopping") {
          if (!nonEmptyString(row.name)) fail(`${path}.name`, "nom obligatoire.");
          if (typeof row.checked !== "boolean") fail(`${path}.checked`, "valeur vrai/faux obligatoire.");
          if (typeof row.category !== "string") fail(`${path}.category`, "texte obligatoire.");
          if (row.type === "food") {
            if (!amountOk(row.qty)) fail(`${path}.qty`, "quantité finie positive ou nulle obligatoire.");
            if (!UNITS.has(row.unit)) fail(`${path}.unit`, "unité non prise en charge.");
          } else if (row.type === "other") {
            if (row.qtyText !== undefined && typeof row.qtyText !== "string") fail(`${path}.qtyText`, "texte attendu.");
          } else {
            fail(`${path}.type`, "type food ou other attendu.");
          }
        } else if (name === "cakes") {
          if (!nonEmptyString(row.name)) fail(`${path}.name`, "nom obligatoire.");
          if (row.icon !== undefined && typeof row.icon !== "string") fail(`${path}.icon`, "texte attendu.");
          if (!Number.isInteger(row.portions) || row.portions < 1) fail(`${path}.portions`, "nombre entier supérieur à zéro obligatoire.");
          validateIngredients(row.ingredients, `${path}.ingredients`, fail);
          if (row.status !== "planned" && row.status !== "done") fail(`${path}.status`, "statut planned ou done attendu.");
          if (row.month !== undefined && !monthOk(row.month)) fail(`${path}.month`, "mois invalide (AAAA-MM attendu).");
          if (row.doneAt !== undefined && (typeof row.doneAt !== "string" || Number.isNaN(Date.parse(row.doneAt)))) fail(`${path}.doneAt`, "date de réalisation invalide.");
        }
      }
    }

    const recipeIds = new Set(stores.recipes.filter(isRecord).map(recipe => recipe.id));
    const mealSlots = new Set();
    stores.meals.forEach((meal, index) => {
      if (!isRecord(meal)) return;
      if (!recipeIds.has(meal.recipeId)) fail(`stores.meals[${index}].recipeId`, "aucune recette correspondante.");
      if (dateOk(meal.date) && (meal.slot === "midi" || meal.slot === "soir")) {
        const slotKey = `${meal.date}/${meal.slot}`;
        if (mealSlots.has(slotKey)) fail(`stores.meals[${index}]`, "deux repas occupent le même créneau.");
        mealSlots.add(slotKey);
      }
    });

    const settings = payload.settings;
    if (settings.season !== null && settings.season !== undefined && !SEASONS.has(settings.season)) fail("settings.season", "saison inconnue.");
    if (settings.specialEvent !== null && settings.specialEvent !== undefined && !EVENTS.has(settings.specialEvent)) fail("settings.specialEvent", "événement inconnu.");
    if (settings.unitWeights !== null && settings.unitWeights !== undefined) {
      if (typeof settings.unitWeights !== "string") {
        fail("settings.unitWeights", "chaîne JSON ou valeur nulle attendue.");
      } else {
        try {
          const weights = JSON.parse(settings.unitWeights);
          if (!isRecord(weights) || (weights.potato !== undefined && (!Number.isFinite(Number(weights.potato)) || Number(weights.potato) <= 0))) fail("settings.unitWeights", "réglages de poids invalides.");
        } catch {
          fail("settings.unitWeights", "JSON de réglages invalide.");
        }
      }
    }
    if (errors.length) throw new Error(errors.join("\n"));
    return { stores, settings, counts: Object.fromEntries(STORE_NAMES.map(name => [name, stores[name].length])) };
  }

  function validateIngredients(value, path, fail) {
    if (!Array.isArray(value)) {
      fail(path, "tableau obligatoire.");
      return;
    }
    value.forEach((ingredient, index) => {
      if (!Array.isArray(ingredient) || ingredient.length !== 3) {
        fail(`${path}[${index}]`, "format [nom, quantité, unité] attendu.");
        return;
      }
      if (!nonEmptyString(ingredient[0])) fail(`${path}[${index}][0]`, "nom obligatoire.");
      if (!amountOk(ingredient[1])) fail(`${path}[${index}][1]`, "quantité finie positive ou nulle obligatoire.");
      if (!UNITS.has(ingredient[2])) fail(`${path}[${index}][2]`, "unité non prise en charge.");
    });
  }

  return { STORE_NAMES, validateBackup };
});

/* Phase 1 DA test : charge les styles saisonniers après la validation, sans modifier la logique métier. */
if (typeof document !== "undefined") {
  const seasonalLink = document.createElement("link");
  seasonalLink.rel = "stylesheet";
  seasonalLink.href = "seasonal-test.css?v=autumn-halloween-r1";
  document.head.appendChild(seasonalLink);
}
