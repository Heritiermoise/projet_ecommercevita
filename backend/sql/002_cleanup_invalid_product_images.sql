-- Nettoyage professionnel des URLs image produit invalides
-- Compatible MariaDB/MySQL
-- Exécuter AVANT ou APRÈS déploiement, en toute sécurité.

-- 1) Prévisualiser les valeurs suspectes
SELECT id, nom, image_principale
FROM produits
WHERE image_principale IS NOT NULL
  AND TRIM(image_principale) <> ''
  AND (
    image_principale LIKE '%\\"%'
    OR image_principale LIKE '%\\\\%'
    OR image_principale LIKE 'https://"%'
    OR image_principale NOT REGEXP '^(https?://[^[:space:]]+|/[^[:space:]]+)$'
  );

-- 2) Normaliser les chemins contenant des anti-slash et guillemets échappés
UPDATE produits
SET image_principale = REPLACE(REPLACE(REPLACE(TRIM(image_principale), '\\\\', '/'), '\\"', ''), '"', '')
WHERE image_principale IS NOT NULL
  AND TRIM(image_principale) <> '';

-- 3) Préfixer par / les chemins relatifs de type dossier/fichier
UPDATE produits
SET image_principale = CONCAT('/', image_principale)
WHERE image_principale IS NOT NULL
  AND TRIM(image_principale) <> ''
  AND image_principale NOT LIKE 'http://%'
  AND image_principale NOT LIKE 'https://%'
  AND image_principale NOT LIKE '/%'
  AND image_principale LIKE '%/%';

-- 4) Mettre à NULL ce qui reste invalide (évite les images cassées)
UPDATE produits
SET image_principale = NULL
WHERE image_principale IS NOT NULL
  AND TRIM(image_principale) <> ''
  AND image_principale NOT REGEXP '^(https?://[^[:space:]]+|/[^[:space:]]+)$';
