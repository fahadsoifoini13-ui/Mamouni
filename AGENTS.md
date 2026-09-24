# Consignes Codex pour Mamouni

## Contexte utilisateur
- Mamouni est d’abord une application personnelle pour l’épouse de l’utilisateur.
- L’appareil de référence est son iPhone 16, avec l’application web ajoutée à l’écran d’accueil.
- La priorité est de préserver une utilisation simple et fiable au quotidien. La diffusion familiale, publique ou sur les stores est une étape future.
- L’utilisateur a des notions de code très élémentaires. Expliquer les changements et les manipulations en français simple.

## Données de référence
- La sauvegarde `data-reference/matbakh-sauvegarde-2026-09-24.json` est la référence des recettes et du stock réels, ainsi que de l’état exporté des repas, courses, gâteaux et réglages.
- Les données d’exemple codées dans `app/app.js` sont obsolètes pour l’usage réel. Ne pas les présenter comme la référence métier.
- Ne jamais importer, remplacer, supprimer ou transformer la sauvegarde de référence ou les données de production sans une instruction explicite de l’utilisateur.
- Ne jamais inclure la sauvegarde JSON dans Git, GitHub, une capture d’écran, un rapport public ou un outil externe. Le motif est exclu par `.gitignore`.
- Avant toute opération sur des données : expliquer précisément la source, la destination, le caractère réversible et la vérification prévue. Préserver une copie intacte.

## Règles de travail
- Pour le premier audit, lire les fichiers et rendre un rapport seulement. Ne modifier aucun fichier de l’application, aucune donnée et aucun service distant.
- Ne pas créer/configurer Supabase, déployer, changer l’URL de production, publier sur un store, ou modifier le contenu de l’iPhone sans demande claire.
- Avant une modification, décrire le comportement actuel, les fichiers concernés, le risque pour l’iPhone et une méthode de retour arrière.
- Préserver les fonctions existantes : sauvegarde/restauration, recettes, stock, repas, courses, gâteaux, installation PWA et usage hors ligne.
- Un changement de base locale, de schéma IndexedDB, d’import/export ou de service worker doit être traité comme sensible : proposer d’abord un plan de migration et de retour arrière.
- Distinguer les faits observés des hypothèses. Ne pas affirmer que le contenu du dossier est identique à la production en ligne sans comparaison explicite.
- Ne pas ajouter de dépendance ni de service payant sans expliquer pourquoi et demander le choix de l’utilisateur.
- Expliquer les commandes et les étapes à effectuer sans supposer que l’utilisateur sait programmer.
