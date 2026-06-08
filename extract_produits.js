import mysql from 'mysql2/promise';

async function extract() {
  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '',
      database: 'miniprojet_ecommerce'
    });

    console.log('✅ Connecté à MySQL');
    
    const [rows] = await connection.query('SELECT id, nom, image_principale FROM produits LIMIT 20');
    
    console.log('Résultats de la table "produits":');
    console.table(rows);
    
    await connection.end();
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

extract();
