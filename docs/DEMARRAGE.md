# Guide de reprise

## Pour comprendre le projet

Ouvrir le dossier `Mamouni-Codex` comme projet dans Codex. Commencer par `AGENTS.md`, puis consulter les rapports d’audit dans `docs/`. Le rapport initial décrit l’état observé à cette date ; vérifier le code courant avant de s’appuyer sur ses constats.

## Données de l’iPhone

La copie locale et l’application de production ont des bases séparées. Ne jamais demander à l’utilisatrice d’effacer le site, son historique ou les données du navigateur. Avant une évolution importante, lui faire exporter la sauvegarde depuis l’application installée et conserver le fichier intact dans Fichiers. Ne pas utiliser le JSON de référence comme un fichier de test ou l’ajouter au dépôt.

## Dépôt et publication

Le dépôt GitHub est `fahadsoifoini13-ui/Mamouni`. La branche `main` est reliée à Netlify, qui publie `app/` automatiquement après chaque push. Vérifier le dépôt, les tests et le diff avant tout push vers `main` : ce push déclenche une nouvelle version du site utilisé par l’iPhone.

## Tests locaux

Les tests automatisés se lancent avec `node --test tests/*.test.cjs`. L’aperçu local peut être servi depuis le dossier `app/`; utiliser uniquement des données synthétiques dans ce navigateur de test. Un résultat local ne prouve pas que l’iPhone ou Netlify a reçu la nouvelle version.

## Architecture future

Supabase n’est pas configuré et aucune migration n’est en cours. Avant de le préparer, établir avec l’utilisatrice les besoins de synchronisation, les comptes, la sauvegarde et la procédure de retour arrière. Toute première expérimentation doit utiliser un environnement distinct et une copie synthétique des données.
