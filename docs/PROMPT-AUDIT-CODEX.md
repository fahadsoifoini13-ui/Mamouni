Tu travailles sur Mamouni, une application personnelle utilisée principalement par mon épouse sur iPhone 16 depuis l’écran d’accueil. Je ne suis pas développeur. Lis d’abord `AGENTS.md`, `README.md`, `docs/SOURCE-OF-TRUTH.md` et `docs/AUDIT-INITIAL.md`.

Pour cette première étape, fais uniquement un audit en lecture seule. Ne modifie aucun fichier, ne lance aucun déploiement, n’importe pas les données et ne configure aucun service externe. Ne lance pas de tests sans me le demander.

Inspecte l’application actuelle et rends un rapport en français simple qui indique :
1. comment l’application démarre et où elle conserve les données ;
2. comment fonctionnent sauvegarde, restauration, données d’exemple, repas, stock, courses et gâteaux ;
3. les risques de perte ou de duplication de données, notamment sur iPhone entre Safari et l’app ajoutée à l’écran d’accueil ;
4. ce qui diffère entre le README, le code et la sauvegarde réelle ;
5. les fichiers à modifier pour chaque risque, sans les modifier ;
6. un ordre de travail prudent, d’abord sans backend, puis les décisions à prendre avant Supabase ;
7. les questions auxquelles seule mon épouse ou moi pouvons répondre.

La sauvegarde dans `data-reference/` est la référence des données domestiques. Les recettes et le stock d’exemple dans le code sont obsolètes pour l’usage réel. Ne reproduis pas la liste complète des recettes dans ton rapport. Distingue les faits vérifiés de tes suppositions et signale si l’environnement de production n’a pas été comparé à ces fichiers.
