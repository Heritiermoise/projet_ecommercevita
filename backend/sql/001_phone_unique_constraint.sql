-- Migration SQL: unicité téléphone pour utilisateurs (MySQL 8+)
-- Exécute ce script UNE FOIS sur ta base hébergée avant le déploiement final.

-- 1) Vérifier les doublons existants (après normalisation)
SELECT
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(telephone, ''), ' ', ''), '-', ''), '.', ''), '(', ''), ')', ''), '+', '') AS telephone_normalise,
  COUNT(*) AS total
FROM utilisateurs
WHERE COALESCE(TRIM(telephone), '') <> ''
GROUP BY telephone_normalise
HAVING COUNT(*) > 1;

-- Si la requête ci-dessus retourne des lignes, corrige les doublons avant de continuer.

-- 2) Ajouter une colonne normalisée (générée)
ALTER TABLE utilisateurs
ADD COLUMN IF NOT EXISTS telephone_normalise VARCHAR(32)
GENERATED ALWAYS AS (
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(telephone, ''), ' ', ''), '-', ''), '.', ''), '(', ''), ')', ''), '+', '')
) STORED;

-- 3) Forcer l'unicité sur téléphone normalisé
CREATE UNIQUE INDEX uk_utilisateurs_telephone_norm
ON utilisateurs (telephone_normalise);
