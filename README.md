# Mamouni

Mamouni est une application web personnelle de recettes, stock, repas, courses et gâteaux. Elle fonctionne comme une PWA et conserve ses données dans IndexedDB sur chaque appareil.

## Organisation

- `app/` contient l’application publiée par Netlify.
- `tests/` contient les vérifications automatisées de validation JSON et de protection du stockage.
- `docs/` contient les audits et les consignes de reprise.
- `data-reference/` contient une sauvegarde privée de référence, exclue de Git.
- `recovery/` contient l’archive d’origine, exclue de Git.

Le dépôt GitHub `fahadsoifoini13-ui/Mamouni` utilise `main` pour la production. Netlify est relié à cette branche, publie le dossier `app/` et lance automatiquement un déploiement après un push. Un push vers `main` modifie donc le site de production.

## Contrôles locaux

Avec Node.js installé, depuis la racine du dépôt :

```sh
node --check app/app.js
node --check app/data-validation.js
node --check app/sw.js
node --test tests/*.test.cjs
```

Les données de référence ne doivent jamais être ajoutées à Git ni importées automatiquement dans l’application. Pour les règles de travail et de protection des données, lire [AGENTS.md](AGENTS.md).
