# Guide de démarrage pour l’utilisateur

## Ce que cette copie protège

Le dossier `Mamouni-Codex` est une copie de travail. L’archive originale est gardée dans `recovery/`, et le code décompressé est suivi dans Git local. La sauvegarde des vraies données est présente dans `data-reference/` mais exclue de Git.

Cette copie ne change pas l’application installée sur l’iPhone. Elle ne prouve pas à elle seule que la version en ligne correspond exactement à l’archive fournie.

## Première séance Codex

1. Dans Codex, ouvrir le dossier `Mamouni-Codex` comme projet.
2. Vérifier que Codex a lu `AGENTS.md`.
3. Coller le texte de `PROMPT-AUDIT-CODEX.md`.
4. Lire le rapport avant de demander une correction. Pour chaque point, demander une explication simple et son risque pour les données.
5. Garder les changements futurs sur une version de test. L’iPhone de ta femme reste sur la version actuelle jusqu’à une validation explicite.

## Routine de sauvegarde à adopter

Avant une grosse évolution ou un changement de version, exporter depuis l’application installée sur l’iPhone et enregistrer le fichier dans Fichiers, puis en garder une copie datée ailleurs. Pour le moment, conserver le fichier actuel comme référence intacte. Ne pas le remplacer par un export d’essai.

Avant de restaurer : vérifier le nom et la date du fichier, son nombre de recettes et d’articles de stock, puis exporter l’état actuel du téléphone. Une restauration remplace les données locales de l’application.

## GitHub

Le dépôt local est prêt à garder l’historique du code. Aucun compte ni dépôt GitHub n’a été relié. Avant de le publier, vérifier que `data-reference/*.json` et `recovery/*` restent exclus, puis créer un dépôt privé. Ne pas coller de mot de passe ou de clé secrète dans Codex.

## Plus tard : Supabase

Avant toute migration, il faudra définir les comptes et l’accès (pour l’instant une utilisatrice principale), traduire les recettes et unités réelles en modèle de données, prévoir l’import idempotent, sauvegarde/restauration et retour arrière, puis faire un prototype séparé. La migration ne commence qu’après validation de ces éléments et un essai avec une copie des données.
