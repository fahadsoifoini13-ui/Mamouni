# Premiers constats — audit documentaire en lecture seule

Date de réception des pièces jointes : 24 septembre 2026.

## Fichiers examinés

- Archive `Matbakh-VDEF-final-4-stable.zip`, 12 fichiers, SHA-256 `1b145d1f09a1268788b6baed13a3205532073d37634d9213b1d9846892e09f46`.
- Sauvegarde JSON décrite dans `SOURCE-OF-TRUTH.md`.

L’archive fournit une app web statique : `index.html`, `styles.css`, `app.js`, `sw.js`, un manifeste PWA et des icônes. Le README inclus parle de « VDEF stable 3 », alors que l’application, le cache PWA et la sauvegarde indiquent `vdef-final-4`. Il faudra corriger/clarifier cette documentation après validation.

## Architecture visible

- L’interface et la logique sont dans un seul fichier `app/app.js`.
- Les données sont conservées dans IndexedDB sur l’appareil, avec la base `mamouni-v1`, version 2.
- Les sauvegardes utilisent un export/import JSON avec les cinq compartiments recettes, stock, repas, courses et gâteaux.
- L’app est une PWA installable avec service worker ; aucune connexion Supabase ou serveur applicatif n’apparaît dans cette archive.

## Points à examiner avant de toucher à l’app

1. `seed()` ajoute recettes, stock et gâteaux de démonstration si chaque compartiment correspondant est vide. Un import partiel ou des recettes vides peut donc faire réapparaître les données d’exemple.
2. L’interface précise que Safari et l’app installée sur l’écran d’accueil peuvent avoir des stockages séparés. La sauvegarde exportée est le pont de transfert ; ne pas supposer qu’une mise à jour du code synchronise les données.
3. L’import remplace les compartiments locaux après confirmation et tente de sauvegarder l’état précédent dans `localStorage`. Il faut examiner précisément l’ordre et les cas d’échec avant de s’appuyer dessus comme restauration garantie.
4. Le service worker met en cache l’app shell et supprime les anciens caches à l’activation. Les mises à jour doivent être vérifiées sur une copie de test pour éviter un mélange de code et de stockage local.
5. Le bouton de réinitialisation recharge les données de démonstration. Il ne doit jamais être utilisé sur l’iPhone réel pendant l’audit.
6. Le README fourni ne correspond pas entièrement aux marqueurs de version présents dans le code.

## Vérifications de structure effectuées

- Les données de référence contiennent 242 lignes d’ingrédients dans les 47 recettes.
- Aucun des 64 repas exportés ne référence un identifiant de recette absent.
- Il s’agit d’un contrôle structurel uniquement, pas d’une vérification culinaire ou d’un test sur iPhone.

Aucun fichier applicatif ni donnée de production n’a été modifié pendant cet état des lieux. Aucun test automatisé ou déploiement n’a été lancé.
