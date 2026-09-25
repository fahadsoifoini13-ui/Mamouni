# Application Mamouni

`index.html`, `styles.css`, `app.js` et `data-validation.js` forment l’application web. `sw.js` gère le cache hors ligne. Netlify publie directement le contenu de ce dossier.

## Données locales

IndexedDB conserve les recettes, le stock, les repas, les courses et les gâteaux dans `mamouni-v1`. Le schéma actuel est en version 3 et ajoute le store `meta` sans supprimer ni vider les stores existants. Les réglages de saison et de conversion y sont aussi conservés. Une base vide est valide et ne crée aucune donnée d’exemple.

## Sauvegarde

L’export comprend les cinq stores et les réglages. La restauration exige un tableau pour chaque store, valide les relations entre repas et recettes, recalcule les courses alimentaires puis remplace tous les stores au cours d’une transaction IndexedDB. Une copie de l’état précédent reste disponible pour retour arrière jusqu’à une modification suivante.

## Thèmes

Les saisons partagent la même structure d’interface. La saison choisie et l’événement spécial sont des réglages locaux. Halloween ajoute des illustrations à l’ambiance automnale et peut être désactivé indépendamment.
