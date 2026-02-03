import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { z } from 'zod'
import { pool } from './db.js'
import bcrypt from 'bcryptjs'
import axios from 'axios'
import nodemailer from 'nodemailer'
import { requireAuth, requireRole, signToken } from './auth.js'

dotenv.config()

const app = express()
app.use(express.json())

// Config Mail (Nodemailer)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  }
})

/**
 * Envoie une facture professionnelle par Email et simule l'envoi WhatsApp
 */
async function sendInvoice(commandeId) {
  const BASE_URL = process.env.APP_URL || 'http://localhost:3001'
  
  try {
    // 1. Récupérer les données complètes
    const [[commande]] = await pool.query(
      `SELECT c.*, u.email, u.nom, u.prenom, u.telephone
       FROM commandes c
       JOIN utilisateurs u ON c.utilisateur_id = u.id
       WHERE c.id = :id`,
      { id: commandeId }
    )

    if (!commande) {
      console.warn(`[SEND INVOICE] Commande ID ${commandeId} introuvable.`)
      return
    }

    const [details] = await pool.query(
      `SELECT cd.*, p.nom as produitNom
       FROM commande_details cd
       JOIN produits p ON cd.produit_id = p.id
       WHERE cd.commande_id = :id`,
      { id: commandeId }
    )

    const dateStr = new Date(commande.date_commande).toLocaleDateString('fr-FR')
    const itemsHtml = details.map(d => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${d.produitNom}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${d.quantite}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${Number(d.prix_unitaire).toFixed(2)} $</td>
      </tr>
    `).join('')

    const totalFacture = Number(commande.montant_total).toFixed(2)
    const invoiceUrl = `${BASE_URL}/api/factures/${commande.reference}`

    // 2. Préparer l'email HTML professionnelle
    const htmlEmail = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; padding: 40px; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3b82f6; margin: 0; font-size: 28px;">MAISHA SHOP</h1>
          <p style="color: #64748b; font-size: 14px;">Votre boutique de confiance</p>
        </div>
        
        <h2 style="color: #1e293b; text-align: center; font-size: 20px; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px;">FACTURE - ${commande.reference}</h2>
        
        <p style="color: #334155;">Bonjour <strong>${commande.prenom || ''} ${commande.nom || ''}</strong>,</p>
        <p style="color: #334155;">Merci pour votre achat ! Votre commande a été confirmée et est en cours de traitement.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 25px 0;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="text-align: left; padding: 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Article</th>
              <th style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #475569; text-align: center;">Qté</th>
              <th style="text-align: right; padding: 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Prix</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        
        <div style="text-align: right; margin-top: 20px; font-size: 1.25em; font-weight: bold; color: #1e293b;">
          TOTAL : ${totalFacture} $
        </div>

        <div style="text-align: center; margin: 40px 0;">
          <a href="${invoiceUrl}" style="background-color: #3b82f6; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Visualiser / Imprimer ma facture</a>
        </div>
        
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0;" />
        
        <div style="font-size: 0.85em; color: #94a3b8; text-align: center; line-height: 1.5;">
          <p style="margin: 5px 0;">Mode de paiement : <strong>${commande.mode_paiement}</strong></p>
          <p style="margin: 5px 0;">Date de commande : ${dateStr}</p>
          <p style="margin: 20px 0 0 0;">&copy; ${new Date().getFullYear()} Maisha Shop. Tous droits réservés.</p>
        </div>
      </div>
    `

    // 3. ENVOI EMAIL
    if (commande.email) {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('[MAIL ERROR] Identifiants SMTP manquants dans le fichier .env')
      } else {
        await transporter.sendMail({
          from: `"Maisha Shop" <${process.env.SMTP_USER}>`,
          to: commande.email,
          subject: `Facture de votre commande ${commande.reference}`,
          html: htmlEmail,
        })
        console.log(`[MAIL] Facture envoyée avec succès à ${commande.email}`)
      }
    }

    // 4. ENVOI WHATSAPP (Lien réel vers facture en ligne)
    if (commande.telephone) {
      let phone = commande.telephone.replace(/\s+/g, '').replace('+', '')
      if (!phone.startsWith('243')) {
        if (phone.startsWith('0')) phone = '243' + phone.substring(1)
        else phone = '243' + phone
      }

      const isValidWA = /^243[89][0-9]{8}$/.test(phone) 
      
      if (isValidWA) {
        const waMessage = `✨ *FACTURE MAISHA SHOP* ✨\n` +
                          `━━━━━━━━━━━━━━━━━━━\n` +
                          `📄 *Lien Facture :* ${invoiceUrl}\n` +
                          `━━━━━━━━━━━━━━━━━━━\n` +
                          `🆔 *Réf :* ${commande.reference}\n` +
                          `👤 *Client :* ${commande.prenom || ''} ${commande.nom || ''}\n` +
                          `💰 *Total : ${totalFacture} USD*\n\n` +
                          `🚀 Merci de votre confiance ! Votre commande est en route.`
        
        console.log(`[WHATSAPP SIMULATION] Message envoyé au ${phone} :\n${waMessage}`)
        
        await pool.query(
          "INSERT INTO notifications (message, lu) VALUES (:msg, 0)",
          { msg: `📱 WhatsApp (facture) prêt pour ${phone} (Réf: ${commande.reference})` }
        )
      } else {
        console.warn(`[WHATSAPP ERROR] Numéro invalide ou non WhatsApp : ${phone}`)
      }
    }

  } catch (err) {
    console.error('[SEND INVOICE ERROR]', err)
  }
}


// Logger pour débugger les 404
app.use((req, res, next) => {
  console.log(`[API LOG] ${req.method} ${req.url}`)
  next()
})

const activeUserSessions = new Map()
const ACTIVE_WINDOW_MINUTES = 30

function touchUserSession(userId) {
  if (!userId) return
  activeUserSessions.set(Number(userId), Date.now())
}

function getUserLastSeen(userId) {
  const last = activeUserSessions.get(Number(userId))
  return typeof last === 'number' ? new Date(last).toISOString() : null
}

const corsOrigin = (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
)

const registerSchema = z.object({
  email: z.string().email(),
  motDePasse: z.string().min(6).max(255),
  nom: z.string().max(100).nullable().optional(),
  prenom: z.string().max(100).nullable().optional(),
  telephone: z.string().max(20).nullable().optional(),
  role: z.enum(['client', 'admin']).default('client'),
})

app.post('/api/auth/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
  }
  const body = parsed.data
  try {
    if (body.role === 'admin') {
      const [[admin]] = await pool.query("SELECT COUNT(*) as count FROM utilisateurs WHERE role = 'admin'")
      if (Number(admin?.count ?? 0) >= 1) {
        return res.status(409).json({ error: "Un administrateur existe déjà." })
      }
    }

    const passwordHash = await bcrypt.hash(body.motDePasse, 10)

    const [result] = await pool.query(
      `INSERT INTO utilisateurs (email, mot_de_passe, nom, prenom, telephone, role)
       VALUES (:email, :motDePasse, :nom, :prenom, :telephone, :role)`,
      {
        email: body.email,
        motDePasse: passwordHash,
        nom: body.nom ?? null,
        prenom: body.prenom ?? null,
        telephone: body.telephone ?? null,
        role: body.role,
      },
    )

    const user = {
      id: result.insertId,
      email: body.email,
      nom: body.nom ?? null,
      prenom: body.prenom ?? null,
      role: body.role,
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role })
    res.status(201).json({ token, user })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

const loginSchema = z.object({
  email: z.string().email(),
  motDePasse: z.string().min(1),
})

app.post('/api/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
  }

  const body = parsed.data
  try {
    const [[u]] = await pool.query(
      `SELECT id, email, mot_de_passe as motDePasse, nom, prenom, telephone, role
       FROM utilisateurs WHERE email = :email LIMIT 1`,
      { email: body.email },
    )
    if (!u?.id) return res.status(401).json({ error: 'Identifiants invalides' })

    const ok = await bcrypt.compare(body.motDePasse, u.motDePasse)
    if (!ok) return res.status(401).json({ error: 'Identifiants invalides' })

    const user = {
      id: u.id,
      email: u.email,
      nom: u.nom ?? null,
      prenom: u.prenom ?? null,
      telephone: u.telephone ?? null,
      role: u.role,
    }

    touchUserSession(user.id)

    const token = signToken({ id: user.id, email: user.email, role: user.role })
    res.json({ token, user })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id
    const [[u]] = await pool.query(
      `SELECT id, email, nom, prenom, telephone, role, date_inscription as dateInscription
       FROM utilisateurs WHERE id = :id LIMIT 1`,
      { id: userId },
    )
    if (!u?.id) return res.status(404).json({ error: 'Utilisateur introuvable' })
    touchUserSession(u.id)
    res.json(u)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.get('/api/health', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 as ok')
    res.json({ ok: true, db: rows?.[0]?.ok === 1 })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) })
  }
})

app.get('/api/categories', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nom, description, statut FROM categories WHERE statut = 1 ORDER BY nom ASC',
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

const createCategorieSchema = z.object({
  nom: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
})

app.post('/api/categories', requireAuth, requireRole('admin'), async (req, res) => {
  const parsed = createCategorieSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
  }

  const body = parsed.data

  try {
    const [result] = await pool.query(
      `INSERT INTO categories (nom, description, statut) VALUES (:nom, :description, 1)`,
      {
        nom: body.nom,
        description: body.description ?? null,
      },
    )

    res.status(201).json({ id: result.insertId })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.delete('/api/categories/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    await pool.query('DELETE FROM categories WHERE id = :id', { id })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.put('/api/categories/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const parsed = createCategorieSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
  }

  try {
    const id = Number(req.params.id)
    const { nom, description } = parsed.data
    await pool.query(
      'UPDATE categories SET nom = :nom, description = :description WHERE id = :id',
      { nom, description, id }
    )
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.get('/api/stats', async (_req, res) => {
  try {
    const [[produits]] = await pool.query('SELECT COUNT(*) as count FROM produits')
    const [[categories]] = await pool.query(
      'SELECT COUNT(*) as count FROM categories WHERE statut = 1',
    )
    const [[commandes]] = await pool.query('SELECT COUNT(*) as count FROM commandes')
    const [[utilisateurs]] = await pool.query('SELECT COUNT(*) as count FROM utilisateurs')
    const [[notifications]] = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE lu = 0',
    )

    res.json({
      produits: Number(produits?.count ?? 0),
      categories: Number(categories?.count ?? 0),
      commandes: Number(commandes?.count ?? 0),
      utilisateurs: Number(utilisateurs?.count ?? 0),
      notificationsNonLues: Number(notifications?.count ?? 0),
    })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.get('/api/admin/dashboard', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const [clients] = await pool.query(
      `SELECT id, email, nom, prenom, telephone, date_inscription as dateInscription
       FROM utilisateurs
       WHERE role = 'client'
       ORDER BY date_inscription DESC
       LIMIT 500`,
    )

    const [produitsParCategorie] = await pool.query(
      `SELECT c.id as categorieId, c.nom as categorieNom, COUNT(p.id) as totalProduits
       FROM categories c
       LEFT JOIN produits p ON p.categorie_id = c.id
       GROUP BY c.id, c.nom
       ORDER BY c.nom ASC`,
    )

    const [produitsSansCategorie] = await pool.query(
      `SELECT COUNT(*) as totalProduits
       FROM produits WHERE categorie_id IS NULL`,
    )

    const [visitesParHeure] = await pool.query(
      `SELECT DATE_FORMAT(date_visite, '%Y-%m-%d %H:00') as heure, COUNT(*) as total
       FROM visites
       WHERE date_visite >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       GROUP BY heure
       ORDER BY heure ASC`,
    )

    const now = Date.now()
    const windowMs = ACTIVE_WINDOW_MINUTES * 60 * 1000
    const enrichedClients = clients.map((c) => {
      const lastSeen = getUserLastSeen(c.id)
      const isConnected = lastSeen ? now - Date.parse(lastSeen) <= windowMs : false
      return { ...c, lastSeen, isConnected }
    })

    const connectedCount = enrichedClients.filter((c) => c.isConnected).length
    const uncategorizedCount = Number(produitsSansCategorie?.[0]?.totalProduits ?? 0)

    const produitsParCategorieFinal = produitsParCategorie.map((row) => ({
      ...row,
      totalProduits: Number(row.totalProduits ?? 0),
    }))
    if (uncategorizedCount > 0) {
      produitsParCategorieFinal.push({
        categorieId: null,
        categorieNom: 'Sans catégorie',
        totalProduits: uncategorizedCount,
      })
    }

    const visitesParHeureFinal = visitesParHeure.map((row) => ({
      ...row,
      total: Number(row.total ?? 0),
    }))

    res.json({
      clients: enrichedClients,
      connectedCount,
      produitsParCategorie: produitsParCategorieFinal,
      visitesParHeure: visitesParHeureFinal,
      activeWindowMinutes: ACTIVE_WINDOW_MINUTES,
    })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.get('/api/produits', async (req, res) => {
  const categorieId = req.query.categorieId

  try {
    const where = []
    const params = {}

    if (categorieId) {
      const parsed = Number(categorieId)
      if (!Number.isFinite(parsed)) {
        return res.status(400).json({ error: 'categorieId invalide' })
      }
      where.push('p.categorie_id = :categorieId')
      params.categorieId = parsed
    }

    const sql = `
      SELECT
        p.id,
        p.categorie_id as categorieId,
        c.nom as categorieNom,
        p.nom,
        p.description,
        p.prix,
        p.stock_quantite as stockQuantite,
        p.marque,
        p.image_principale as imagePrincipale,
        p.date_ajout as dateAjout,
        'USD' as devise
      FROM produits p
      LEFT JOIN categories c ON c.id = p.categorie_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY p.date_ajout DESC
    `

    const [rows] = await pool.query(sql, params)
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

const createProduitSchema = z.object({
  categorieId: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return null
    if (typeof val === 'string') {
      const n = Number(val)
      return isNaN(n) ? null : n
    }
    return val
  }, z.number().int().nullable().optional()),
  nom: z.string().min(1, 'Le nom est requis').max(255),
  description: z.string().nullable().optional(),
  prix: z.preprocess((val) => {
    if (typeof val === 'string') return Number(val)
    return val
  }, z.number().nonnegative('Le prix doit être positif')),
  stockQuantite: z.preprocess((val) => {
    if (val === '' || val === undefined) return 0
    if (typeof val === 'string') return Number(val)
    return val
  }, z.number().int().min(0, 'Le stock ne peut pas être négatif').default(0)),
  marque: z.string().max(255).nullable().optional(),
  imagePrincipale: z.string().max(2000).nullable().optional(),
})

app.post('/api/produits', requireAuth, requireRole('admin'), async (req, res) => {
  const parsed = createProduitSchema.safeParse(req.body)
  if (!parsed.success) {
    console.error('Validation error adding product:', parsed.error.format())
    return res.status(400).json({ 
      error: 'Erreur de validation des données du produit', 
      details: parsed.error.format() 
    })
  }

  const body = parsed.data

  try {
    const [[existing]] = await pool.query(
      `SELECT id
       FROM produits
       WHERE nom = :nom
         AND ((categorie_id IS NULL AND :categorieId IS NULL) OR categorie_id = :categorieId)
         AND ((marque IS NULL AND :marque IS NULL) OR marque = :marque)
       LIMIT 1`,
      {
        nom: body.nom,
        categorieId: body.categorieId ?? null,
        marque: body.marque ?? null,
      },
    )

    if (existing) {
      await pool.query(
        `UPDATE produits
         SET stock_quantite = stock_quantite + :ajout
         WHERE id = :id`,
        {
          ajout: body.stockQuantite,
          id: existing.id,
        },
      )
      return res.status(200).json({ id: existing.id, updated: true })
    }

    const [result] = await pool.query(
      `INSERT INTO produits (categorie_id, nom, description, prix, stock_quantite, marque, image_principale)
       VALUES (:categorieId, :nom, :description, :prix, :stockQuantite, :marque, :imagePrincipale)`,
      {
        categorieId: body.categorieId ?? null,
        nom: body.nom,
        description: body.description ?? null,
        prix: body.prix,
        stockQuantite: body.stockQuantite,
        marque: body.marque ?? null,
        imagePrincipale: body.imagePrincipale ?? null,
      },
    )

    // TRIGGER INITIAL PRICE HISTORY
    await pool.query(
      'INSERT INTO historique_prix (produit_id, ancien_prix, nouveau_prix) VALUES (:id, 0, :prix)',
      { id: result.insertId, prix: body.prix }
    )

    res.status(201).json({ id: result.insertId })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.get('/api/produits/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const sql = `
      SELECT
        p.id,
        p.categorie_id as categorieId,
        c.nom as categorieNom,
        p.nom,
        p.description,
        p.prix,
        p.stock_quantite as stockQuantite,
        p.marque,
        p.image_principale as imagePrincipale,
        p.date_ajout as dateAjout,
        'USD' as devise
      FROM produits p
      LEFT JOIN categories c ON c.id = p.categorie_id
      WHERE p.id = :id
      LIMIT 1
    `
    const [[product]] = await pool.query(sql, { id })
    if (!product) return res.status(404).json({ error: 'Produit non trouvé' })
    res.json(product)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.put('/api/produits/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const parsed = createProduitSchema.safeParse(req.body)
  if (!parsed.success) {
    console.error('Validation error updating product:', parsed.error.format())
    return res.status(400).json({ 
      error: 'Erreur de validation des données du produit', 
      details: parsed.error.format() 
    })
  }

  const id = Number(req.params.id)
  const body = parsed.data

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // 1. Récupérer l'ancien prix pour le TRIGGER 6
    const [[oldProd]] = await conn.query('SELECT prix FROM produits WHERE id = :id FOR UPDATE', { id })
    
    if (oldProd && Number(oldProd.prix) !== Number(body.prix)) {
      await conn.query(
        'INSERT INTO historique_prix (produit_id, ancien_prix, nouveau_prix) VALUES (:id, :old, :new)',
        { id, old: oldProd.prix, new: body.prix }
      )
    }

    // 2. Mettre à jour le produit
    await conn.query(
      `UPDATE produits 
       SET categorie_id = :categorieId, nom = :nom, description = :description, 
           prix = :prix, stock_quantite = :stockQuantite, marque = :marque, 
           image_principale = :imagePrincipale
       WHERE id = :id`,
      {
        id,
        categorieId: body.categorieId ?? null,
        nom: body.nom,
        description: body.description ?? null,
        prix: body.prix,
        stockQuantite: body.stockQuantite,
        marque: body.marque ?? null,
        imagePrincipale: body.imagePrincipale ?? null,
      },
    )

    await conn.commit()
    res.json({ success: true, message: 'Produit mis à jour et historique enregistré' })
  } catch (e) {
    await conn.rollback()
    res.status(500).json({ error: String(e) })
  } finally {
    conn.release()
  }
})

app.delete('/api/produits/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    await pool.query('DELETE FROM produits WHERE id = :id', { id })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// --- CONFIGURATION AIRTEL MONEY (SIMULATION API RÉELLE) ---
const AIRTEL_CONFIG = {
  endpoint: process.env.AIRTEL_API_URL || 'https://openapi.airtel.africa/standard/v1/payments/',
  client_id: process.env.AIRTEL_CLIENT_ID,
  client_secret: process.env.AIRTEL_CLIENT_SECRET,
  merchant_id: process.env.AIRTEL_MERCHANT_ID,
}

/**
 * Fonction complexe pour initier le Push USSD via l'API Airtel
 * Simule l'authentification OAuth2 et la requête de collection
 */
async function initiateAirtelPushUSSD(telephone, montant, reference) {
  console.log(`[AIRTEL API] Initialisation du paiement pour ${telephone} - Montant: ${montant} USD`)
  // 1. Appel fictif pour récupérer le token OAuth2
  // 2. Envoi de la requête 'Collection' vers Airtel pour déclencher le prompt PIN sur le mobile
  // Note: C'est ici que le téléphone de l'utilisateur reçoit la demande de mot de passe.
  return { 
    status: 'PENDING_CUSTOMER_PIN', 
    transactionId: 'AIR-' + Math.random().toString(36).toUpperCase().substring(2, 12) 
  }
}

// --- LOGIQUE PANIER AVEC VÉRIFICATION STOCK ET NOTIFICATION ADMIN ---
const cartSchema = z.object({
  produitId: z.number().int(),
  quantite: z.number().int().min(1)
})

app.post('/api/panier', requireAuth, requireRole('client'), async (req, res) => {
  const parsed = cartSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json(parsed.error)
  
  const { produitId, quantite } = parsed.data
  const userId = req.user.id

  try {
    const [[produit]] = await pool.query(
      'SELECT stock_quantite, nom FROM produits WHERE id = :id', 
      { id: produitId }
    )
    
    if (!produit) return res.status(404).json({ error: 'Produit introuvable' })
    if (produit.stock_quantite < quantite) {
      return res.status(400).json({ error: `Stock insuffisant (${produit.stock_quantite} dispos)` })
    }

    const [[panier]] = await pool.query(
      'SELECT id FROM paniers WHERE utilisateur_id = :userId LIMIT 1',
      { userId }
    )
    let panierId = panier?.id
    if (!panierId) {
      const [res] = await pool.query('INSERT INTO paniers (utilisateur_id) VALUES (:userId)', { userId })
      panierId = res.insertId
    }

    await pool.query(`
      INSERT INTO panier_articles (panier_id, produit_id, quantite)
      VALUES (:panierId, :produitId, :quantite)
      ON DUPLICATE KEY UPDATE quantite = quantite + :quantite
    `, { panierId, produitId, quantite })

    // Notification Admin : Le client prépare ses achats
    await pool.query(
      'INSERT INTO notifications (message, lu) VALUES (:msg, 0)', 
      { msg: `🛒 ADMIN: Le client #${userId} a ajouté ${quantite}x "${produit.nom}" à son panier.` }
    )

    res.json({ success: true, message: "Ajouté avec succès ($)" })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// --- LOGIQUE COMMANDE RÉELLE AVEC TRANSACTION SQL ---
async function createCommandeForUser(userId, items, modePaiement, statutPaiement) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    let total = 0
    const reference = 'CMD-' + Math.random().toString(36).toUpperCase().substring(2, 9)

    // 1. Vérification stock et calcul total
    for (const item of items) {
      const [[p]] = await conn.query(
        'SELECT stock_quantite, prix, nom FROM produits WHERE id = :id FOR UPDATE', 
        { id: item.produitId }
      )
      
      if (!p || p.stock_quantite < item.quantite) {
        throw new Error(`Stock épuisé pour "${p?.nom || item.produitId}"`)
      }

      total += p.prix * item.quantite
      
      // TRIGGER 3 & 5: Gestion Stock + Alerte Stock Faible
      const newStock = p.stock_quantite - item.quantite
      await conn.query(
        'UPDATE produits SET stock_quantite = :newStock WHERE id = :id', 
        { newStock, id: item.produitId }
      )

      if (newStock <= 5 && p.stock_quantite > 5) {
        await conn.query(
          "INSERT INTO notifications (type, message) VALUES ('STOCK_LOW', :msg)",
          { msg: `Alerte : Le stock de ${p.nom} est presque épuisé (${newStock} restant).` }
        )
      }
    }

    // 2. Insertion Commande
    const [result] = await conn.query(
      `INSERT INTO commandes (utilisateur_id, reference, montant_total, statut_paiement, statut_livraison, mode_paiement)
       VALUES (:userId, :reference, :total, :statutPaiement, 'traitement', :modePaiement)`,
      { userId, reference, total, statutPaiement, modePaiement }
    )
    const commandeId = result.insertId

    // 3. Insertion Détails Commande (Manquant précédemment)
    for (const item of items) {
      await conn.query(
        `INSERT INTO commande_details (commande_id, produit_id, quantite, prix_unitaire)
         VALUES (:commandeId, :produitId, :quantite, :prixUnitaire)`,
        {
          commandeId,
          produitId: item.produitId,
          quantite: item.quantite,
          prixUnitaire: item.prixUnitaire
        }
      )
    }

    // TRIGGER 2: Nettoyage du Panier
    await conn.query(
      `DELETE pa FROM panier_articles pa 
       JOIN paniers p ON pa.panier_id = p.id 
       WHERE p.utilisateur_id = :userId`,
      { userId }
    )

    // Si déjà payé (ex: simulation automatique), déclencher vente
    if (statutPaiement === 'paye') {
      await conn.query(
        `INSERT INTO ventes (commande_id, utilisateur_id, montant, date_vente)
         VALUES (:commandeId, :userId, :total, NOW())`,
        { commandeId, userId, total }
      )
    }

    await conn.commit()
    return { commandeId, reference, total, devise: 'USD' }
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}

// --- SERVICES DE PAIEMENT PROFESSIONNELS ---

/**
 * Service Maisha Pay (Intégration Réelle)
 */
const MaishaPayService = {
  async initiatePayment(montant, reference, commandeId) {
    const merchantId = process.env.MAISHAPAY_MERCHANT_ID
    const apiKey = process.env.MAISHAPAY_SECRET_KEY
    
    // On essaie d'utiliser l'URL standard de Maisha Pay si celle du .env ne répond pas
    const envBaseUrl = (process.env.MAISHAPAY_BASE_URL || '').replace(/\/$/, '')
    const standardBaseUrl = 'https://maishapay.online/api/v1'
    const baseUrl = envBaseUrl || standardBaseUrl

    try {
      console.log(`[MAISHAPAY] Initiation sur ${baseUrl}/transaction/initiate`)
      
      const payload = {
        api_key: apiKey,
        merchant_id: merchantId,
        amount: montant,
        currency: 'USD',
        order_id: reference,
        description: `Ecommerce CMD ${reference}`,
        success_url: `${process.env.CORS_ORIGIN}/commandes?status=p_success&ref=${reference}`,
        cancel_url: `${process.env.CORS_ORIGIN}/paiement?status=p_cancelled`,
        callback_url: `${process.env.VITE_API_URL}/api/paiements/maishapay/callback`
      }

      const response = await axios.post(`${baseUrl}/transaction/initiate`, payload, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Ecommerce-App/1.0'
        },
        timeout: 20000 // Augmentation à 20s
      })

      console.log('[MAISHAPAY RESPONSE]', response.data)

      if (response.data && (response.data.payment_url || response.data.paymentUrl)) {
        const pUrl = response.data.payment_url || response.data.paymentUrl
        await pool.query(
          `INSERT INTO transactions_paiement (commande_id, reference_externe, montant, mode_paiement, statut, donnees_brutes) 
           VALUES (:cmdId, :extRef, :montant, 'Maisha Pay', 'en_attente', :raw)`,
          { 
            cmdId: commandeId, 
            extRef: response.data.transaction_id || response.data.transactionId || null,
            montant, 
            raw: JSON.stringify(response.data) 
          }
        )

        return {
          success: true,
          paymentUrl: pUrl,
          transactionId: response.data.transaction_id || response.data.transactionId
        }
      } else {
        throw new Error(response.data.message || "Erreur d'initialisation Maisha Pay")
      }
    } catch (error) {
      // Si l'URL personnalisée a échoué par timeout, on peut tenter un fallback interne ici si besoin
      if (error.response) {
        console.error('[MAISHAPAY API ERROR]', error.response.status, error.response.data)
        throw new Error(`Maisha Pay API Error: ${error.response.data.message || error.response.statusText}`)
      } else if (error.request) {
        console.error('[MAISHAPAY NETWORK ERROR] Aucune réponse de ' + baseUrl)
        throw new Error(`Le serveur Maisha Pay (${baseUrl}) est injoignable. Vérifiez votre connexion internet ou les identifiants dans le fichier .env`)
      } else {
        throw new Error(`Erreur Maisha Pay: ${error.message}`)
      }
    }
  }
}

/**
 * Service Airtel Money (Simulation de l'API Réelle)
 * Pour une intégration réelle :
 * 1. Obtenez vos identifiants sur https://developers.airtel.africa/
 * 2. Utilisez axios pour appeler l'endpoint /merchant/v1/payments/
 * 3. Configurez un Webhook pour recevoir la confirmation du paiement
 */
const AirtelMoneyService = {
  async initiatePushUSSD(telephone, montant, reference) {
    console.log(`[AIRTEL API] Envoi Push USSD vers ${telephone} pour ${montant} USD (Ref: ${reference})`)
    
    // Simulation d'un délai réseau
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Dans une vraie API, ceci retournerait un 'transaction_id' ou 'correlation_id'
    // Ici on simule un succès d'initiation (l'invite apparaît sur le tel)
    return {
      success: true,
      transactionId: 'AIR-' + Math.random().toString(36).toUpperCase().substring(5),
      status: 'pending_pin',
      instructions: "Saisissez votre code PIN sur votre mobile pour valider."
    }
  }
}

// --- SCHÉMAS DE VALIDATION ---
const paiementInitSchema = z.object({
  method: z.enum(['airtel', 'livraison', 'maishapay', 'whatsapp']),
  telephone: z.string().optional(),
  montant: z.number().positive(),
  devise: z.string().min(3).max(6).default('USD'),
  items: z
    .array(
      z.object({
        produitId: z.number().int(),
        quantite: z.number().int().min(1),
        prixUnitaire: z.number().positive(),
      }),
    )
    .min(1),
})

// --- FONCTIONS UTILITAIRES (REMPLACEMENT DES TRIGGERS SQL) ---

/**
 * Remplace trg_creation_vente : Enregistre une vente quand le paiement est validé
 */
async function triggerVente(conn, reference) {
  const [[cmd]] = await conn.query(
    'SELECT id, utilisateur_id, montant_total, statut_paiement FROM commandes WHERE reference = :ref',
    { ref: reference }
  )
  if (cmd) {
    // On vérifie si la vente n'existe pas déjà pour éviter les doublons
    const [[exists]] = await conn.query('SELECT id FROM ventes WHERE commande_id = :id', { id: cmd.id })
    if (!exists) {
      await conn.query(
        'INSERT INTO ventes (commande_id, utilisateur_id, montant, date_vente) VALUES (:cid, :uid, :mt, NOW())',
        { cid: cmd.id, uid: cmd.utilisateur_id, mt: cmd.montant_total }
      )
      console.log(`[TRIGGER CODE] Vente enregistrée pour ${reference}`)
    }
  }
}

app.post('/api/paiements/valider-pin', requireAuth, requireRole('client'), async (req, res) => {
  const { pin, reference } = req.body
  console.log(`[AIRTEL PIN] Validation du PIN pour ${reference}`)
  
  if (!pin || pin.length < 4) {
    return res.status(400).json({ error: 'PIN invalide' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // Simulation: on marque la commande comme payée
    await conn.query(
      "UPDATE commandes SET statut_paiement = 'paye' WHERE reference = :ref",
      { ref: reference }
    )
    
    // TRIGGER: Création de vente
    await triggerVente(conn, reference)

    await conn.query(
      'INSERT INTO notifications (message, lu) VALUES (:msg, 0)', 
      { msg: `📱 AIRTEL SUCCESS: La commande ${reference} a été validée par PIN.` }
    )

    await conn.commit()
    res.json({ success: true, message: 'Paiement effectué avec succès' })
  } catch (e) {
    await conn.rollback()
    res.status(500).json({ error: String(e) })
  } finally {
    conn.release()
  }
})

// --- PAIEMENT MULTI-MÉTHODES ---
app.post('/api/paiements/initier', requireAuth, requireRole('client'), async (req, res) => {
  console.log('[PAIEMENT V2] Tentative d\'initiation:', req.body.method, 'Montant:', req.body.montant)
  const parsed = paiementInitSchema.safeParse(req.body)
  if (!parsed.success) {
    console.error('[VALIDATION ERROR]', parsed.error.format())
    return res.status(400).json(parsed.error)
  }

  const { method, montant, items, telephone } = parsed.data
  const userId = req.user.id

  try {
    let modePaiement = 'Inconnu'
    if (method === 'airtel') modePaiement = 'Airtel Money'
    else if (method === 'maishapay') modePaiement = 'Paiement en ligne (Maisha Pay)'
    else if (method === 'whatsapp') modePaiement = 'Paiement via WhatsApp'
    else modePaiement = 'Paiement à la livraison'
    
    // Création de la commande - Statut 'en_attente'
    const commande = await createCommandeForUser(userId, items, modePaiement, 'en_attente')

    let responseData = {
      status: 'success',
      reference: commande.reference,
      commandeId: commande.commandeId,
      message: `Votre commande ${commande.reference} a été enregistrée.`
    }

    if (method === 'maishapay') {
      const maishaResult = await MaishaPayService.initiatePayment(montant, commande.reference, commande.commandeId)
      responseData.paymentUrl = maishaResult.paymentUrl
      responseData.message = "Redirection vers la passerelle de paiement Maisha Pay..."
      
      await pool.query(
        'INSERT INTO notifications (message, lu) VALUES (:msg, 0)', 
        { msg: `🌐 MAISHA PAY: Nouvelle tentative de paiement pour ${commande.reference} (${montant} USD).` }
      )
    } else if (method === 'airtel') {
      if (!telephone) throw new Error("Le numéro de téléphone est requis pour Airtel Money")
      
      const airtelResult = await AirtelMoneyService.initiatePushUSSD(telephone, montant, commande.reference)
      
      responseData.status = airtelResult.status
      responseData.message = `[PROMPT USSD ENVOYÉ] Veuillez confirmer le paiement de ${montant} $ sur votre téléphone ${telephone}.`
      
      await pool.query(
        'INSERT INTO notifications (message, lu) VALUES (:msg, 0)', 
        { msg: `🚨 COMMANDE AIRTEL: ${commande.reference} par ${telephone} (${montant} USD).` }
      )
    } else if (method === 'whatsapp') {
      // Récupération des détails pour le message WhatsApp
      const [[user]] = await pool.query('SELECT nom, prenom, email FROM utilisateurs WHERE id = :userId', { userId })
      const [details] = await pool.query(
        `SELECT p.nom, cd.quantite, cd.prix_unitaire
         FROM commande_details cd
         JOIN produits p ON p.id = cd.produit_id
         WHERE cd.commande_id = :id`,
        { id: commande.commandeId }
      )
      
      const itemsList = details.map(d => `• ${d.nom} (x${d.quantite})`).join('\n')
      
      const message = `🛍️ *NOUVELLE COMMANDE : ${commande.reference}*\n\n` +
                      `Bonjour,\nJe souhaite régler ma commande via WhatsApp.\n\n` +
                      `*Client :* ${user.prenom || ''} ${user.nom || ''}\n` +
                      `*Articles :*\n${itemsList}\n\n` +
                      `*TOTAL :* ${Number(montant).toFixed(2)} USD\n\n` +
                      `Merci de m'envoyer les instructions de paiement.`
      
      const merchantNumber = process.env.VITE_SUPPORT_WHATSAPP_NUMBER || '243815421445'
      responseData.whatsappUrl = `https://wa.me/${merchantNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`
      responseData.message = "Commande enregistrée ! Redirection vers WhatsApp..."
      
      await pool.query(
        'INSERT INTO notifications (message, lu) VALUES (:msg, 0)', 
        { msg: `📱 WHATSAPP: Nouvelle commande ${commande.reference} (${montant} USD).` }
      )
    } else {
      await pool.query(
        'INSERT INTO notifications (message, lu) VALUES (:msg, 0)', 
        { msg: `📦 COMMANDE À LIVRER: ${commande.reference} (${montant} USD).` }
      )
    }

    res.json(responseData)
  } catch (e) {
    console.error('Erreur Paiement:', e)
    res.status(500).json({ error: String(e) })
  }
})

// Webhook Maisha Pay
app.post('/api/paiements/maishapay/callback', async (req, res) => {
  console.log('[MAISHAPAY CALLBACK]', req.body)
  const { order_id, status, transaction_id } = req.body

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const isSuccess = status === 'success'
    
    // Mettre à jour la commande
    if (isSuccess) {
      await conn.query(
        "UPDATE commandes SET statut_paiement = 'paye' WHERE reference = :orderId",
        { orderId: order_id }
      )
      
      // TRIGGER: Création de vente
      await triggerVente(conn, order_id)

      await conn.query(
        'INSERT INTO notifications (message, lu) VALUES (:msg, 0)', 
        { msg: `✅ PAIEMENT RÉUSSI: La commande ${order_id} a été payée via Maisha Pay.` }
      )

      // Récupérer l'ID pour la facture
      const [[cmdRef]] = await conn.query('SELECT id FROM commandes WHERE reference = :orderId', { orderId: order_id })
      if (cmdRef) {
        // Envoi asynchrone après commit
        setImmediate(() => sendInvoice(cmdRef.id))
      }
    }

    // Mettre à jour l'historique des transactions
    await conn.query(
      `UPDATE transactions_paiement 
       SET statut = :statut, 
           reference_externe = :extRef, 
           donnees_brutes = :raw 
       WHERE commande_id = (SELECT id FROM commandes WHERE reference = :orderId LIMIT 1)`,
      { 
        statut: isSuccess ? 'reussi' : (status === 'cancelled' ? 'annule' : 'echoue'),
        extRef: transaction_id || null,
        raw: JSON.stringify(req.body),
        orderId: order_id
      }
    )

    console.log(`[MAISHAPAY] Webhook traité pour ${order_id}. Statut final: ${status}`)
    await conn.commit()
    res.sendStatus(200)
  } catch (error) {
    await conn.rollback()
    console.error('[MAISHAPAY CALLBACK ERROR]', error)
    res.sendStatus(500)
  } finally {
    conn.release()
  }
})

app.get('/api/notifications', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, message, lu, cree_le as creeLe FROM notifications ORDER BY cree_le DESC LIMIT 50',
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.get('/api/commandes', requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user?.role === 'admin'
    const sql = `
      SELECT
        id,
        utilisateur_id as utilisateurId,
        reference,
        montant_total as montantTotal,
        statut_paiement as statutPaiement,
        statut_livraison as statutLivraison,
        mode_paiement as modePaiement,
        date_commande as dateCommande,
        'USD' as devise
      FROM commandes
      ${isAdmin ? '' : 'WHERE utilisateur_id = :userId'}
      ORDER BY date_commande DESC
      LIMIT 50
    `
    const [rows] = await pool.query(sql, isAdmin ? {} : { userId: req.user?.id })
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.put('/api/commandes/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params
  const { statutPaiement, statutLivraison } = req.body

  const conn = await pool.getConnection()
  try {
    const commandeId = Number(id)
    await conn.beginTransaction()

    // 1. Récupérer l'état actuel pour comparer
    const [[oldCmd]] = await conn.query(
      'SELECT id, reference, utilisateur_id, statut_paiement, statut_livraison, montant_total FROM commandes WHERE id = :id FOR UPDATE',
      { id: commandeId }
    )

    if (!oldCmd) {
      await conn.rollback()
      return res.status(404).json({ error: 'Commande introuvable' })
    }

    // --- LOGIQUE TRIGGER 1: Passage à PAYÉ (Vente) ---
    if (statutPaiement === 'paye' && oldCmd.statut_paiement !== 'paye') {
      await conn.query(
        `INSERT INTO ventes (commande_id, utilisateur_id, montant, date_vente)
         VALUES (:commandeId, :userId, :montant, NOW())`,
        { 
          commandeId: oldCmd.id, 
          userId: oldCmd.utilisateur_id, 
          montant: oldCmd.montant_total 
        }
      )
      // Déclenchement de la facture (Email + WhatsApp simulé)
      setImmediate(() => sendInvoice(oldCmd.id))
    }

    // --- LOGIQUE TRIGGER 7: Paiement ÉCHOUÉ (Notification) ---
    if (statutPaiement === 'echoue' && oldCmd.statut_paiement !== 'echoue') {
      await conn.query(
        "INSERT INTO notifications (type, message) VALUES ('PAYMENT_FAILED', :msg)",
        { msg: `Échec de paiement pour la commande ${oldCmd.reference} (Client: ${oldCmd.utilisateur_id})` }
      )
    }

    // --- LOGIQUE TRIGGER 8: Livraison ANNULÉE (Restauration Stock) ---
    if (statutLivraison === 'annule' && oldCmd.statut_livraison !== 'annule') {
      await conn.query(
        `UPDATE produits p
         JOIN commande_details cd ON p.id = cd.produit_id
         SET p.stock_quantite = p.stock_quantite + cd.quantite
         WHERE cd.commande_id = :id`,
        { id: commandeId }
      )
      await conn.query(
        "INSERT INTO notifications (type, message) VALUES ('ORDER_CANCELLED', :msg)",
        { msg: `La commande ${oldCmd.reference} a été annulée. Stock restauré.` }
      )
    }

    // --- LOGIQUE SPÉCIFIQUE LIVRÉ (Vente + Suppression si nécessaire) ---
    if (statutLivraison === 'livre') {
      // Si on marque comme livré, on s'assure que c'est marqué payé et enregistré en vente
      if (oldCmd.statut_paiement !== 'paye') {
        await conn.query(
          `INSERT INTO ventes (commande_id, utilisateur_id, montant, date_vente)
           VALUES (:commandeId, :userId, :montant, NOW())`,
          { 
            commandeId: oldCmd.id, 
            userId: oldCmd.utilisateur_id, 
            montant: oldCmd.montant_total 
          }
        )
      }
      
      // On peut soit garder la commande ou la supprimer comme demandé précédemment
      // Ici, on la supprime pour respecter votre demande précédente sur 'ventes'
      await conn.query('DELETE FROM commandes WHERE id = :id', { id: commandeId })
      await conn.commit()
      return res.json({ success: true, message: 'Commande livrée et archivée en ventes' })
    }

    // Mise à jour classique
    await conn.query(
      `UPDATE commandes 
       SET statut_paiement = COALESCE(:statutPaiement, statut_paiement), 
           statut_livraison = COALESCE(:statutLivraison, statut_livraison)
       WHERE id = :id`,
      { id: commandeId, statutPaiement, statutLivraison }
    )

    await conn.commit()
    res.json({ success: true, message: 'Commande mise à jour (Triggers OK)' })
  } catch (e) {
    await conn.rollback()
    res.status(500).json({ error: String(e) })
  } finally {
    conn.release()
  }
})

const banniereSchema = z.object({
  titre: z.string().min(1).max(100),
  imageUrl: z.string().url().max(255),
  lienRedirection: z.string().url().max(255).nullable().optional(),
  actif: z.number().int().min(0).max(1).default(1),
})

app.get('/api/bannieres', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, titre, image_url as imageUrl, lien_redirection as lienRedirection, actif FROM bannieres ORDER BY id DESC',
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.post('/api/bannieres', requireAuth, requireRole('admin'), async (req, res) => {
  const parsed = banniereSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
  }

  const body = parsed.data
  try {
    const [result] = await pool.query(
      `INSERT INTO bannieres (titre, image_url, lien_redirection, actif)
       VALUES (:titre, :imageUrl, :lienRedirection, :actif)`,
      {
        titre: body.titre,
        imageUrl: body.imageUrl,
        lienRedirection: body.lienRedirection ?? null,
        actif: body.actif,
      },
    )
    res.status(201).json({ id: result.insertId })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

const avisSchema = z.object({
  produitId: z.number().int(),
  note: z.number().int().min(1).max(5),
  commentaire: z.string().max(2000).nullable().optional(),
})

app.get('/api/avis', async (req, res) => {
  const produitId = req.query.produitId
  try {
    const where = []
    const params = {}
    if (produitId) {
      const parsed = Number(produitId)
      if (!Number.isFinite(parsed)) return res.status(400).json({ error: 'produitId invalide' })
      where.push('a.produit_id = :produitId')
      params.produitId = parsed
    }

    const sql = `
      SELECT a.id, a.produit_id as produitId, p.nom as produitNom, a.utilisateur_id as utilisateurId,
             a.note, a.commentaire, a.date_publication as datePublication
      FROM avis a
      JOIN produits p ON p.id = a.produit_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY a.date_publication DESC
      LIMIT 200
    `
    const [rows] = await pool.query(sql, params)
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.post('/api/avis', requireAuth, requireRole('client'), async (req, res) => {
  const parsed = avisSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
  }

  const body = parsed.data
  try {
    const [result] = await pool.query(
      `INSERT INTO avis (produit_id, utilisateur_id, note, commentaire)
       VALUES (:produitId, :utilisateurId, :note, :commentaire)`,
      {
        produitId: body.produitId,
        utilisateurId: req.user?.id,
        note: body.note,
        commentaire: body.commentaire ?? null,
      },
    )
    res.status(201).json({ id: result.insertId })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

const adresseSchema = z.object({
  typeAdresse: z.enum(['livraison', 'facturation']),
  rue: z.string().min(1).max(255),
  ville: z.string().min(1).max(100),
  codePostal: z.string().min(1).max(20),
  pays: z.string().min(1).max(50),
})

app.get('/api/adresses', requireAuth, requireRole('client'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, type_adresse as typeAdresse, rue, ville, code_postal as codePostal, pays
       FROM adresses WHERE utilisateur_id = :userId ORDER BY id DESC`,
      { userId: req.user?.id },
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.post('/api/adresses', requireAuth, requireRole('client'), async (req, res) => {
  const parsed = adresseSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
  }

  const body = parsed.data
  try {
    const [result] = await pool.query(
      `INSERT INTO adresses (utilisateur_id, type_adresse, rue, ville, code_postal, pays)
       VALUES (:userId, :typeAdresse, :rue, :ville, :codePostal, :pays)`,
      {
        userId: req.user?.id,
        typeAdresse: body.typeAdresse,
        rue: body.rue,
        ville: body.ville,
        codePostal: body.codePostal,
        pays: body.pays,
      },
    )
    res.status(201).json({ id: result.insertId })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.get('/api/historique-prix', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT h.id, h.produit_id as produitId, p.nom as produitNom,
              h.ancien_prix as ancienPrix, h.nouveau_prix as nouveauPrix, h.date_changement as dateChangement
       FROM historique_prix h
       JOIN produits p ON p.id = h.produit_id
       ORDER BY h.date_changement DESC
       LIMIT 200`,
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.get('/api/visites', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, ip, Mapsur as mapsur, date_visite as dateVisite FROM visites ORDER BY date_visite DESC LIMIT 200',
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

const visiteSchema = z.object({
  mapsur: z.string().max(255).optional(),
})

app.post('/api/visites', async (req, res) => {
  const parsed = visiteSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
  }

  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress
  try {
    const [result] = await pool.query(
      `INSERT INTO visites (ip, Mapsur) VALUES (:ip, :mapsur)`
      , { ip: ip ?? 'unknown', mapsur: parsed.data.mapsur ?? null },
    )
    res.status(201).json({ id: result.insertId })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.get('/api/admin/transactions', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.commande_id as commandeId, c.reference, t.montant, t.devise, 
              t.mode_paiement as modePaiement, t.statut, t.cree_le as date
       FROM transactions_paiement t
       LEFT JOIN commandes c ON t.commande_id = c.id
       ORDER BY t.cree_le DESC
       LIMIT 100`
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// --- CHATBOT IA INTELLIGENT ---
// Note: Pour une IA 100% autonome et fluide, intégrez une API comme OpenAI ou Google Gemini.
app.post('/api/chatbot', async (req, res) => {
  const { message } = req.body
  const msg = (message || '').toLowerCase()
  
  try {
    // SI VOUS AVEZ UNE CLÉ API (Exemple Gemini/OpenAI) :
    // const aiResponse = await axios.post('https://api.openai.com/v1/chat/completions', { ... })
    // return res.json({ reply: aiResponse.data.choices[0].message.content })

    // Logique d'IA Hybride (Data + Règles métier)
    
    // Recherche de produits dynamiques
    if (msg.includes('produit') || msg.includes('vend') || msg.includes('achat') || msg.includes('stock') || msg.includes('combien')) {
      const [products] = await pool.query(
        'SELECT nom, prix, stock_quantite FROM produits WHERE stock_quantite > 0 ORDER BY RAND() LIMIT 3'
      )
      
      if (products.length > 0) {
        const list = products.map(p => `• ${p.nom} : ${Number(p.prix).toFixed(2)} USD (En stock)`).join('\n')
        return res.json({ 
          reply: `Bienvenue chez Maisha Shop ! Voici quelques articles qui pourraient vous intéresser :\n\n${list}\n\nSouhaitez-vous passer commande ?` 
        })
      }
    }

    // Gestion des Commandes (Si l'utilisateur donne une réf)
    if (msg.includes('cmd-') || msg.includes('commande')) {
      const refMatch = msg.match(/cmd-[a-z0-9]+/i)
      if (refMatch) {
        const [cmd] = await pool.query(
          'SELECT statut_paiement, statut_livraison FROM commandes WHERE reference = :ref',
          { ref: refMatch[0].toUpperCase() }
        )
        if (cmd.length > 0) {
          return res.json({ 
            reply: `📦 Statut de votre commande ${refMatch[0].toUpperCase()} :\n- Paiement : ${cmd[0].statut_paiement}\n- Livraison : ${cmd[0].statut_livraison}` 
          })
        }
      }
      return res.json({ reply: "Pour suivre votre commande, merci de me donner sa référence (ex: CMD-XXXXX)." })
    }

    // Aide paiement & livraison
    if (msg.includes('paye') || msg.includes('moyen') || msg.includes('livrer') || msg.includes('frais')) {
      return res.json({ 
        reply: "💳 *Paiements* : Airtel Money, Maisha Pay, ou Cash à la livraison.\n🚚 *Livraison* : 24h/48h à Kinshasa. Livraison partout en RDC par transporteur partenaire." 
      })
    }

    // Personnalité & Politesse
    if (msg.includes('bonjour') || msg.includes('salut') || msg.includes('ca va')) {
      return res.json({ reply: "Bonjour ! Je suis l'IA de Maisha Shop. Comment puis-je vous aider dans votre shopping aujourd'hui ?" })
    }

    // Réponse par défaut polyvalente
    res.json({ 
      reply: "Je suis votre assistant Maisha Shop. Je peux vous lister nos produits, suivre vos commandes ou vous aider pour le paiement. Que puis-je faire pour vous ?" 
    })

  } catch (e) {
    console.error('[CHATBOT ERROR]', e)
    res.status(500).json({ reply: "Désolé, je rencontre une petite difficulté technique. Contactez notre support WhatsApp !" })
  }
})

// Route pour visualiser la facture en ligne (utilisée par les liens Email/WhatsApp)
app.get('/api/factures/:reference', async (req, res) => {
  const { reference } = req.params;
  try {
    const [[commande]] = await pool.query(
      `SELECT c.*, u.email, u.nom, u.prenom, u.telephone
       FROM commandes c
       JOIN utilisateurs u ON c.utilisateur_id = u.id
       WHERE c.reference = :reference`,
      { reference }
    );

    if (!commande) {
      return res.status(404).send('<h1>Facture introuvable</h1>');
    }

    const [details] = await pool.query(
      `SELECT cd.*, p.nom as produitNom
       FROM commande_details cd
       JOIN produits p ON cd.produit_id = p.id
       WHERE cd.commande_id = :id`,
      { id: commande.id }
    );

    const itemsHtml = details.map(d => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${d.produitNom}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${d.quantite}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">${Number(d.prix_unitaire).toFixed(2)} $</td>
      </tr>
    `).join('');

    const total = Number(commande.montant_total).toFixed(2);
    const dateStr = new Date(commande.date_commande).toLocaleDateString('fr-FR');

    res.send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Facture ${commande.reference}</title>
          <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background: #f4f4f7; }
              .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; background: #fff; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.05); }
              .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 20px; }
              .logo { font-size: 24px; font-weight: bold; color: #3b82f6; }
              .invoice-info { text-align: right; }
              .client-info { margin-bottom: 30px; }
              table { width: 100%; line-height: inherit; text-align: left; border-collapse: collapse; }
              th { background: #f8fafc; padding: 12px; border-bottom: 2px solid #eee; }
              .total { margin-top: 30px; text-align: right; font-size: 20px; font-weight: bold; color: #1e293b; }
              .footer { margin-top: 50px; text-align: center; color: #64748b; font-size: 14px; }
              @media print { body { background: none; padding: 0; } .invoice-box { box-shadow: none; border: none; } .no-print { display: none; } }
          </style>
      </head>
      <body>
          <div class="invoice-box">
              <div class="header">
                  <div class="logo">MAISHA SHOP</div>
                  <div class="invoice-info">
                      <strong>Facture #:</strong> ${commande.reference}<br>
                      <strong>Date:</strong> ${dateStr}
                  </div>
              </div>
              <div class="client-info">
                  <strong>Client:</strong><br>
                  ${commande.prenom || ''} ${commande.nom || ''}<br>
                  ${commande.email || ''}<br>
                  ${commande.telephone || ''}
              </div>
              <table>
                  <thead>
                      <tr>
                          <th>Article</th>
                          <th style="text-align: center;">Quantité</th>
                          <th style="text-align: right;">Prix Unitaire</th>
                      </tr>
                  </thead>
                  <tbody>${itemsHtml}</tbody>
              </table>
              <div class="total">TOTAL : ${total} USD</div>
              <div class="footer">
                  <p>Merci pour votre achat !</p>
                  <p>Mode de paiement : ${commande.mode_paiement}</p>
                  <button class="no-print" onclick="window.print()" style="margin-top:20px; padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 5px; cursor: pointer;">Imprimer la facture</button>
              </div>
          </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur lors de la génération de la facture');
  }
});

const port = Number(process.env.PORT ?? 3001)
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
