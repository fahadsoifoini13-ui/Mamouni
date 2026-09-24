# Mamouni — espace de reprise Codex

Cet espace réunit la version fournie de l’application, la sauvegarde réelle des données et les consignes de travail pour poursuivre le projet sans modifier la version utilisée sur l’iPhone.

## Ce qui est inclus

- `app/` : copie décompressée de l’archive `Matbakh-VDEF-final-4-stable.zip` (12 fichiers).
- `recovery/` : archive originale, conservée comme copie de secours.
- `data-reference/` : sauvegarde JSON fournie le 24 septembre 2026. Elle est exclue du suivi Git car elle contient les données personnelles de la maison.
- `AGENTS.md` : règles permanentes pour tout agent Codex travaillant dans ce dossier.
- `docs/` : inventaire, premiers constats et guide de démarrage.

L’archive se nomme **Matbakh**, tandis que son titre d’application est « Matbakh » et sa base locale s’appelle `mamouni-v1`. Ce dossier est appelé Mamouni pour suivre le nom du projet dans la conversation.

## Démarrer dans Codex

1. Ouvrir ce dossier `Mamouni-Codex` comme projet local dans Codex.
2. Donner le prompt d’audit de `docs/PROMPT-AUDIT-CODEX.md`.
3. Lire le rapport produit et poser les questions à Codex avant toute modification.
4. Ne publier aucune nouvelle version avant d’avoir validé les sauvegardes, le plan et l’essai sur une adresse de test. L’iPhone de référence reste la version de production actuelle.

Le dépôt Git local conserve le code et les documents. Aucun dépôt GitHub n’est configuré. Avant de publier ce dépôt en ligne, vérifier les fichiers suivis et garder la sauvegarde JSON privée.

## Étape suivante recommandée

Faire l’audit statique en lecture seule, puis valider ensemble un plan de stabilisation. L’import réel et la migration vers Supabase attendent une procédure de sauvegarde, de restauration et de validation approuvée. Supabase n’est pas configuré ici.
