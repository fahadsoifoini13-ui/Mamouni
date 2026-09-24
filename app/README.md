# Matbakh — VDEF stable 3

Version de stabilisation de la VDEF locale.

## Correctifs principaux
- Correction d'une erreur d'initialisation : le stock de démonstration appelait `stockCategory()` avant l'initialisation de `ALIASES`.
- Conservation du schéma IndexedDB v2 : aucune montée de version inutile, afin d'éviter de bloquer une base existante ouverte par une ancienne instance.
- Migration des unités `kg/cl/L` vers `g/ml` conservée au niveau des données.
- Normalisation des variantes d'ingrédients conservée.
- Convertisseur et poids moyen des pommes de terre conservés.
- Gestion des erreurs de démarrage renforcée, y compris pour les erreurs survenant avant l'installation des handlers de `app.js`.
- Cache PWA versionné en `vdef-final-3`.

## Test conseillé
Déployer sur une URL Netlify de test et vérifier l'ouverture, puis les onglets Accueil, Mes repas, Recettes, Stock et Courses avant de remplacer une version contenant les données réelles.


## Audit de stabilisation V3
- Correction de la cause du `Script error` observé sur certaines VDEF : les données seed ne référencent plus une constante (`ALIASES`) avant son initialisation.
- `DB_VERSION` reste à 2 pour éviter une migration IndexedDB inutile et préserver la compatibilité avec la VDEF stable précédente.
- Ouverture IndexedDB rendue défensive : détection de l’absence d’IndexedDB, timer correctement initialisé et gestion explicite du blocage.
- Service worker versionné en V3 avec `updateViaCache: none` pour limiter les collisions avec un ancien cache PWA.
- Les données locales restent stockées dans IndexedDB sous `mamouni-v1`.
