-- Permet le stockage des images importées depuis disque local (data URL base64)
-- Compatible MariaDB / MySQL

ALTER TABLE produits
  MODIFY image_principale LONGTEXT NULL;

ALTER TABLE bannieres
  MODIFY image_url LONGTEXT NOT NULL;
