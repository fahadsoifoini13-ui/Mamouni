# Source de vérité des données

Fichier reçu dans la conversation : `data-reference/matbakh-sauvegarde-2026-09-24.json`.

- Format : `matbakh-backup`, version 1.
- Version de l’app déclarée dans l’export : `vdef-final-4`.
- Base locale déclarée : `mamouni-v1`.
- Export créé le 24 septembre 2026 à 16:55:29 UTC.
- Référence absolue demandée : les 47 recettes et les 120 articles de stock.
- Les 64 repas, les 36 éléments de courses, les 3 gâteaux et les réglages sont aussi conservés dans le fichier comme instantané exporté, mais les repas et courses évoluent avec le temps.
- Empreinte SHA-256 : `f91cf5b6fdb5fdc4c28a32064eb2220f76091304cf9cff0d32a0085dc5137c5f`.

L’empreinte permet de reconnaître le fichier original. Toute correction ultérieure doit créer un nouvel export daté et conserver l’original. Ce fichier contient des données personnelles et ne doit pas être publié. À l’import, l’application recalcule les courses à partir des repas futurs et des gâteaux prévus ; les lignes de courses exportées ne sont donc pas toutes préservées telles quelles.

La cohérence de base vérifiée ici : les 64 repas pointent vers une recette existante. Cette vérification ne confirme pas que chaque quantité ou ingrédient est correct ; la validation métier se fera avec l’utilisatrice.
