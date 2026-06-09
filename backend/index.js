import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import fs from 'node:fs/promises'
import { z } from 'zod'
import { pool, testDbConnection } from './db.js'
import bcrypt from 'bcryptjs'
import axios from 'axios'
import nodemailer from 'nodemailer'
import dns from 'node:dns'
import QRCode from 'qrcode'
import puppeteer from 'puppeteer'
import { requireAuth, requireRole, signToken } from './auth.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Correction professionnelle des erreurs DNS ETIMEOUT sur Windows/Node.js
dns.setDefaultResultOrder('ipv4first')

// Configuration DNS alternative pour éviter les timeouts DNS système
import dnsPromises from 'node:dns/promises'
dns.setServers(['8.8.8.8', '8.8.4.4']) // Utilise les DNS de Google pour plus de fiabilité

dotenv.config()

function resolvePublicAppUrl() {
  const candidates = [
    process.env.APP_URL,
    process.env.PUBLIC_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    'http://localhost:3001',
  ]

  for (const candidate of candidates) {
    const value = String(candidate || '').trim().replace(/\/+$/, '')
    if (value) return value
  }

  return 'http://localhost:3001'
}

const BASE_URL = resolvePublicAppUrl()
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim() || ''
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash'
const PROJECT_ROOT = path.resolve(__dirname, '..')
const PROJECT_SEARCH_DIRS = ['src', 'backend', 'docs', 'public', 'scripts']
const PROJECT_SEARCH_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.html', '.css', '.mjs', '.sql', '.txt', '.toml', '.ini'])
const PROJECT_IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.vite'])
const PROJECT_MAX_FILES = 80
const PROJECT_MAX_SNIPPETS = 6
const PROJECT_MAX_FILE_SIZE = 250000
const PROJECT_STOPWORDS = new Set([
  'avec', 'dans', 'des', 'du', 'les', 'une', 'the', 'and', 'pour', 'sur', 'que', 'qui', 'quoi', 'comment',
  'est', 'sont', 'avoir', 'faire', 'pas', 'plus', 'moins', 'this', 'that', 'what', 'how', 'why', 'when', 'where',
  'chez', 'vers', 'par', 'mon', 'ton', 'son', 'nos', 'vos', 'leurs', 'tes', 'ces', 'cet', 'cette',
])

function normalizeQuestionTerms(message) {
  return [...new Set(
    String(message || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z0-9]+/g)
      .map((term) => term.trim())
      .filter((term) => term.length >= 3 && !PROJECT_STOPWORDS.has(term))
      .slice(0, 8)
  )]
}

function formatRelativeProjectPath(filePath) {
  return path.relative(PROJECT_ROOT, filePath).split(path.sep).join('/')
}

function extractSnippetLines(lines, lineIndex) {
  const start = Math.max(0, lineIndex - 2)
  const end = Math.min(lines.length, lineIndex + 3)
  return lines.slice(start, end).join('\n').trim()
}

async function collectProjectContext(message) {
  const terms = normalizeQuestionTerms(message)
  if (terms.length === 0) return []

  const matches = []
  let scannedFiles = 0

  async function scanFile(filePath) {
    if (matches.length >= PROJECT_MAX_SNIPPETS || scannedFiles >= PROJECT_MAX_FILES) return

    const ext = path.extname(filePath).toLowerCase()
    if (!PROJECT_SEARCH_EXTS.has(ext)) return

    let stat
    try {
      stat = await fs.stat(filePath)
    } catch {
      return
    }

    if (!stat.isFile() || stat.size > PROJECT_MAX_FILE_SIZE) return

    let content
    try {
      content = await fs.readFile(filePath, 'utf8')
    } catch {
      return
    }

    scannedFiles += 1
    const lowerContent = content.toLowerCase()
    const score = terms.reduce((total, term) => total + (lowerContent.includes(term) ? 1 : 0), 0)
    if (score === 0) return

    const lines = content.split(/\r?\n/)
    const snippets = []
    for (let index = 0; index < lines.length && snippets.length < 2; index += 1) {
      const line = lines[index].toLowerCase()
      if (terms.some((term) => line.includes(term))) {
        snippets.push(extractSnippetLines(lines, index))
      }
    }

    if (snippets.length === 0) return

    matches.push({
      path: formatRelativeProjectPath(filePath),
      snippets,
      score,
    })
  }

  async function walkDirectory(directoryPath) {
    if (matches.length >= PROJECT_MAX_SNIPPETS || scannedFiles >= PROJECT_MAX_FILES) return

    let entries
    try {
      entries = await fs.readdir(directoryPath, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (matches.length >= PROJECT_MAX_SNIPPETS || scannedFiles >= PROJECT_MAX_FILES) break

      const fullPath = path.join(directoryPath, entry.name)
      if (entry.isDirectory()) {
        if (PROJECT_IGNORE_DIRS.has(entry.name)) continue
        await walkDirectory(fullPath)
        continue
      }

      if (entry.isFile()) {
        await scanFile(fullPath)
      }
    }
  }

  for (const relativeDir of PROJECT_SEARCH_DIRS) {
    if (matches.length >= PROJECT_MAX_SNIPPETS || scannedFiles >= PROJECT_MAX_FILES) break
    await walkDirectory(path.join(PROJECT_ROOT, relativeDir))
  }

  return matches.sort((left, right) => right.score - left.score)
}

function formatProjectContext(matches) {
  if (matches.length === 0) return ''

  return matches.map((match) => {
    const snippets = match.snippets.map((snippet) => `- ${snippet.replace(/\n+/g, '\n  ')}`).join('\n')
    return `Fichier: ${match.path}\n${snippets}`
  }).join('\n\n')
}

function isGreetingMessage(message) {
  const msg = String(message || '').toLowerCase().trim()
  return /^(salut|bonjour|hello|hi|coucou|yo|bonsoir|hey)(\b|[!.,?\s]*)/.test(msg)
    || msg === 'ca va'
    || msg === 'ça va'
    || msg.includes('comment ca va')
    || msg.includes('comment ça va')
}

function isThanksMessage(message) {
  const msg = String(message || '').toLowerCase()
  return msg.includes('merci') || msg.includes('thanks') || msg.includes('remercie')
}

function isGoodbyeMessage(message) {
  const msg = String(message || '').toLowerCase()
  return msg.includes('au revoir') || msg.includes('bye') || msg.includes('à plus') || msg.includes('a plus') || msg.includes('bonne nuit')
}

function isProjectOrProductQuestion(message) {
  const msg = String(message || '').toLowerCase()
  return [
    'projet', 'code', 'backend', 'frontend', 'route', 'api', 'assistant', 'chatbot', 'produit', 'commande',
    'paiement', 'panier', 'categorie', 'utilisateur', 'adresses', 'visites', 'notifications', 'bannieres',
    'prix', 'stock', 'connexion', 'auth', 'supabase', 'mysql', 'gemini', 'README',
  ].some((term) => msg.includes(term.toLowerCase()))
}

async function askGemini(message, projectContext = '') {
  if (!GEMINI_API_KEY) return null

  const systemInstruction = [
    'Tu es l\'assistant officiel du projet e-commerce Maisha Shop.',
    'Réponds toujours en français, de manière professionnelle, claire et concrète.',
    'Si un contexte projet est fourni, base ta réponse prioritairement dessus et n\'invente rien.',
    'Si l\'information n\'est pas présente dans le contexte projet, dis-le explicitement et propose une piste utile.',
    'Pour une question générale ou externe, réponds normalement avec une réponse courte mais correcte.',
  ].join(' ')

  const userPrompt = projectContext
    ? `Question utilisateur:\n${message}\n\nContexte extrait du projet:\n${projectContext}`
    : `Question utilisateur:\n${message}`

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        topP: 0.95,
        maxOutputTokens: 512,
      },
    }),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`Gemini API error (${response.status}): ${details}`)
  }

  const data = await response.json()
  const reply = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || '')
    .join('')
    .trim()

  return reply || null
}

function fallbackChatbotReply(message) {
  const msg = String(message || '').toLowerCase()

  if (isGreetingMessage(msg)) {
    return 'Salut ! Je vais bien, merci. Comment puis-je vous aider sur le projet ou sur une question externe ?'
  }

  if (isThanksMessage(msg)) {
    return 'Avec plaisir. Si vous voulez, je peux aussi fouiller dans le projet pour trouver la réponse exacte.'
  }

  if (isGoodbyeMessage(msg)) {
    return 'À bientôt. Revenez quand vous voulez, je serai là pour le projet comme pour les autres questions.'
  }

  if (msg.includes('aide')) {
    return "Je peux vous aider à :\n1. Trouver un produit 🔍\n2. Suivre une commande 📦\n3. Comprendre les modes de paiement 💳\n4. Contacter un humain 👨‍💼"
  }

  if (msg.includes('paiement')) {
    return "💳 Nous acceptons :\n- Airtel Money\n- Maisha Pay (Cartes & Mobile)\n- Cash à la livraison (sous conditions)"
  }

  if (msg.includes('contact')) {
    return 'Vous pouvez nous joindre par WhatsApp au +243 000 000 000 ou par email à support@maishashop.com'
  }

  if (msg.includes('qui') || msg.includes('quoi') || msg.includes('maisha') || msg.includes('entreprise')) {
    return "Maisha Shop est la plateforme e-commerce du projet. Nous proposons une expérience d'achat, de paiement et de suivi de commande organisée autour du catalogue, de l'administration et du support client."
  }

  return "Je n'ai pas trouvé de réponse exacte dans ma base locale. Donnez-moi plus de détails sur le produit, la commande ou le module concerné, et je chercherai dans le projet."
}

const app = express()
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json())

app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'JSON invalide dans la requête.' })
  }
  next(err)
})

// Config Mail (Nodemailer) pilotée par les variables d'environnement
const smtpHost = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com'
const smtpPort = Number(process.env.SMTP_PORT || 465)
const smtpSecure = String(process.env.SMTP_SECURE ?? (smtpPort === 465 ? 'true' : 'false')).toLowerCase() === 'true'

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: process.env.SMTP_USER?.trim(),
    pass: process.env.SMTP_PASS?.replace(/\s+/g, ''),
  },
  tls: {
    rejectUnauthorized: false,
    servername: smtpHost,
  },
  connectionTimeout: 45000,
  greetingTimeout: 30000,
  socketTimeout: 60000,
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
})

// Vérification de la connexion avec retry logic
const verifySMTP = (retries = 3) => {
  transporter.verify((error) => {
    if (error) {
      if (retries > 0) {
        console.warn(`[MAIL SYSTEM] Echec connexion SMTP, tentative de reconnexion (${retries} restantes)...`);
        setTimeout(() => verifySMTP(retries - 1), 5000);
      } else {
        console.error('[MAIL SYSTEM] Système Email hors ligne après plusieurs tentatives.', error.message);
      }
    } else {
      console.log('[MAIL SYSTEM] Serveur SMTP prêt (Connexion Directe IP).');
    }
  });
};

verifySMTP();

/**
 * Envoie une facture professionnelle par Email et simule l'envoi WhatsApp
 */
async function sendInvoice(commandeId, reference = null) {
  try {
    // 1. Récupérer les données (soit par ID soit par Référence si archivée)
    let query = `
      SELECT c.*, u.email, u.nom, u.prenom, u.telephone
      FROM commandes c
      JOIN utilisateurs u ON c.utilisateur_id = u.id
      WHERE c.id = :id
    `;
    let params = { id: commandeId };

    if (!commandeId && reference) {
      query = `
        SELECT v.id, v.reference, v.montant as montant_total, v.date_vente as date_commande, 
               u.email, u.nom, u.prenom, u.telephone
        FROM ventes v
        JOIN utilisateurs u ON v.utilisateur_id = u.id
        WHERE v.reference = :ref
      `;
      params = { ref: reference };
    }

    const [[commande]] = await pool.query(query, params)

    if (!commande) {
      console.warn(`[SEND INVOICE] Commande/Vente introuvable (ID: ${commandeId}, Ref: ${reference}).`)
      return
    }

    // 2. Récupérer les détails (soit commande_details soit vente_details)
    let detailQuery = `
      SELECT cd.*, p.nom as produitNom
      FROM commande_details cd
      JOIN produits p ON cd.produit_id = p.id
      WHERE cd.commande_id = :id
    `;
    let detailParams = { id: commande.id };

    if (!commandeId && reference) {
      detailQuery = `
        SELECT vd.*, p.nom as produitNom
        FROM vente_details vd
        JOIN produits p ON vd.produit_id = p.id
        WHERE vd.vente_id = :id
      `;
    }

    const [details] = await pool.query(detailQuery, detailParams)

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
          from: process.env.SMTP_FROM
            ? `"Maisha Shop" <${process.env.SMTP_FROM}>`
            : `"Maisha Shop" <${process.env.SMTP_USER}>`,
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

      // Vérification plus souple de l'indicatif RDC (243) + 9 chiffres
      const isValidWA = /^243[0-9]{9}$/.test(phone) 
      
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
        
        // Insertion d'une trace réelle de l'envoi WhatsApp dans la DB
        await pool.query(
          "INSERT INTO notifications (message, lu) VALUES (:msg, 0)",
          { msg: `📱 WhatsApp prêt pour ${phone} (Commande: ${commande.reference})` }
        )
      } else {
        console.warn(`[WHATSAPP ERROR] Numéro invalide pour la RDC (doit être 243 + 9 chiffres) : ${phone}`)
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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'api' })
})

app.get('/api/health/db', async (_req, res) => {
  try {
    await testDbConnection()
    res.json({ status: 'ok', service: 'db' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur DB inconnue'
    res.status(500).json({ status: 'error', service: 'db', error: message })
  }
})

const registerSchema = z.object({
  email: z.string().email(),
  motDePasse: z.string().min(6).max(255),
  nom: z.string().max(100).nullable().optional(),
  prenom: z.string().max(100).nullable().optional(),
  telephone: z.string().max(20).nullable().optional(),
  role: z.enum(['client', 'admin']).default('client'),
})

function normalizePhone(phone) {
  if (!phone) return null
  const normalized = String(phone).trim().replace(/\D+/g, '')
  return normalized.length ? normalized : null
}

app.post(['/api/auth/register', '/api/inscription.php'], async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
  }
  const body = parsed.data
  const email = String(body.email).trim()
  const normalizedPhone = normalizePhone(body.telephone)
  try {
    // Vérifier si l'email existe déjà
    const [[existingEmail]] = await pool.query('SELECT id FROM utilisateurs WHERE email = :email LIMIT 1', { 
      email 
    })
    if (existingEmail) {
      return res.status(409).json({ error: "Cet email est déjà utilisé." })
    }

    // Vérifier si le téléphone existe déjà
    if (normalizedPhone) {
       const [[existingTel]] = await pool.query(
         `SELECT id
          FROM utilisateurs
          WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(telephone, ''), ' ', ''), '-', ''), '.', ''), '(', ''), ')', ''), '+', '') = :telephone
          LIMIT 1`,
         {
           telephone: normalizedPhone,
         },
       )
       if (existingTel) {
         return res.status(409).json({ error: "Ce numéro de téléphone est déjà utilisé." })
       }
    }

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
        email,
        motDePasse: passwordHash,
        nom: body.nom ?? null,
        prenom: body.prenom ?? null,
        telephone: body.telephone?.trim() || null,
        role: body.role,
      },
    )

    const user = {
      id: result.insertId,
      email,
      nom: body.nom ?? null,
      prenom: body.prenom ?? null,
      telephone: body.telephone ?? null,
      role: body.role,
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role })
    res.status(201).json({ token, user })
  } catch (e) {
    if (e && typeof e === 'object' && e.code === 'ER_DUP_ENTRY') {
      const message = String(e.sqlMessage || e.message || '')
      if (message.includes('telephone') || message.includes('uk_utilisateurs_telephone_norm')) {
        return res.status(409).json({ error: 'Ce numéro de téléphone est déjà utilisé.' })
      }
      if (message.includes('email')) {
        return res.status(409).json({ error: 'Cet email est déjà utilisé.' })
      }
      return res.status(409).json({ error: 'Conflit de données: valeur déjà utilisée.' })
    }
    res.status(500).json({ error: String(e) })
  }
})

const loginSchema = z.object({
  email: z.string().email(),
  motDePasse: z.string().min(1),
})

app.post(['/api/auth/login', '/api/connexion.php'], async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
  }

  const body = parsed.data
  const email = String(body.email).trim()
  try {
    const [[u]] = await pool.query(
      `SELECT id, email, mot_de_passe as motDePasse, nom, prenom, telephone, role
       FROM utilisateurs WHERE email = :email LIMIT 1`,
      { email },
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

    // Calcul du montant total vendu sur les 60 derniers jours
    const [[ventes60Jours]] = await pool.query(
      `SELECT SUM(montant) as total FROM ventes 
       WHERE date_vente >= DATE_SUB(NOW(), INTERVAL 60 DAY)`
    )

    // Calcul du montant total cumulé (temps réel)
    const [[ventesTotal]] = await pool.query('SELECT SUM(montant) as total FROM ventes')

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
      statsVentes: {
        total60Jours: Number(ventes60Jours?.total ?? 0),
        totalGlobal: Number(ventesTotal?.total ?? 0)
      }
    })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// Historique de vente pour Admin (Longue durée)
app.get('/api/admin/ventes/historique', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT v.id, v.commande_id as commandeId, v.montant, v.date_vente as dateVente,
              c.reference, u.nom, u.prenom
       FROM ventes v
       JOIN commandes c ON v.commande_id = c.id
       JOIN utilisateurs u ON v.utilisateur_id = u.id
       ORDER BY v.date_vente DESC
       LIMIT 1000`
    )
    res.json(rows)
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
  imagePrincipale: z.string().max(8_000_000).nullable().optional(),
})

function sanitizeProductImageUrl(value) {
  if (value === null || value === undefined) return null
  let normalized = String(value).trim()
  if (!normalized) return null

  normalized = normalized.replace(/^['"]+|['"]+$/g, '')
  normalized = normalized.replace(/\\+/g, '/')
  normalized = normalized.replace(/\s+/g, ' ').trim()

  if (!normalized) return null

  const lowerNormalized = normalized.toLowerCase()
  const mediaIndex = lowerNormalized.indexOf('/media/')
  if (mediaIndex >= 0) {
    const mediaPath = normalized.slice(mediaIndex)
    return encodeURI(mediaPath)
  }

  const publicIndex = lowerNormalized.indexOf('/public/')
  if (publicIndex >= 0) {
    const afterPublic = normalized.slice(publicIndex + '/public'.length)
    return encodeURI(afterPublic.startsWith('/') ? afterPublic : `/${afterPublic}`)
  }

  if (/^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/i.test(normalized)) {
    return normalized
  }

  if (/^https?:\/\//i.test(normalized)) {
    try {
      const parsed = new URL(normalized)
      const host = parsed.hostname
      const validHost =
        host === 'localhost' ||
        host.includes('.') ||
        /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
        (host.startsWith('[') && host.endsWith(']'))
      if (!validHost) return null
      return parsed.toString()
    } catch {
      return null
    }
  }

  if (normalized.startsWith('//')) return `https:${normalized}`

  if (/^[A-Za-z]:\//.test(normalized)) {
    normalized = normalized.replace(/^[A-Za-z]:\//, '/')
  }

  if (normalized.startsWith('/')) return encodeURI(normalized)

  if (normalized.includes('/')) return encodeURI(`/${normalized.replace(/^\/+/, '')}`)

  return null
}

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
  const sanitizedImage = sanitizeProductImageUrl(body.imagePrincipale)

  if (body.imagePrincipale && !sanitizedImage) {
    return res.status(400).json({
      error: "URL d'image invalide. Utilisez une URL http(s) valide ou un chemin commençant par /."
    })
  }

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
        imagePrincipale: sanitizedImage,
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
  const sanitizedImage = sanitizeProductImageUrl(body.imagePrincipale)

  if (body.imagePrincipale && !sanitizedImage) {
    return res.status(400).json({
      error: "URL d'image invalide. Utilisez une URL http(s) valide ou un chemin commençant par /."
    })
  }

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
        imagePrincipale: sanitizedImage,
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

const updateCartSchema = z.object({
  quantite: z.number().int().min(1),
})

async function getOrCreatePanierId(userId) {
  const [[panier]] = await pool.query(
    'SELECT id FROM paniers WHERE utilisateur_id = :userId LIMIT 1',
    { userId },
  )

  if (panier?.id) return panier.id

  const [result] = await pool.query('INSERT INTO paniers (utilisateur_id) VALUES (:userId)', {
    userId,
  })
  return result.insertId
}

app.get('/api/panier', requireAuth, requireRole('client'), async (req, res) => {
  const userId = req.user.id
  try {
    const [[panier]] = await pool.query('SELECT id FROM paniers WHERE utilisateur_id = :userId LIMIT 1', {
      userId,
    })

    if (!panier?.id) {
      return res.json({ items: [] })
    }

    const [rows] = await pool.query(
      `SELECT pa.id, pa.panier_id as panierId, pa.produit_id as produitId, pa.quantite,
              p.nom as produitNom, p.prix as prixUnitaire, p.image_principale as imagePrincipale,
              p.stock_quantite as stockQuantite
       FROM panier_articles pa
       JOIN produits p ON p.id = pa.produit_id
       WHERE pa.panier_id = :panierId
       ORDER BY pa.id DESC`,
      { panierId: panier.id },
    )

    res.json({ items: rows })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
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

    const panierId = await getOrCreatePanierId(userId)

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

app.put('/api/panier/:produitId', requireAuth, requireRole('client'), async (req, res) => {
  const produitId = Number(req.params.produitId)
  const parsed = updateCartSchema.safeParse(req.body)
  if (!Number.isFinite(produitId)) return res.status(400).json({ error: 'produitId invalide' })
  if (!parsed.success) return res.status(400).json(parsed.error)

  const userId = req.user.id
  const { quantite } = parsed.data

  try {
    const [[produit]] = await pool.query('SELECT stock_quantite FROM produits WHERE id = :id', { id: produitId })
    if (!produit) return res.status(404).json({ error: 'Produit introuvable' })
    if (produit.stock_quantite < quantite) {
      return res.status(400).json({ error: `Stock insuffisant (${produit.stock_quantite} dispos)` })
    }

    const [[panier]] = await pool.query('SELECT id FROM paniers WHERE utilisateur_id = :userId LIMIT 1', {
      userId,
    })
    if (!panier?.id) return res.status(404).json({ error: 'Panier introuvable' })

    const [result] = await pool.query(
      `UPDATE panier_articles
       SET quantite = :quantite
       WHERE panier_id = :panierId AND produit_id = :produitId`,
      { panierId: panier.id, produitId, quantite },
    )

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Article panier introuvable' })
    }

    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.delete('/api/panier/:produitId', requireAuth, requireRole('client'), async (req, res) => {
  const produitId = Number(req.params.produitId)
  if (!Number.isFinite(produitId)) return res.status(400).json({ error: 'produitId invalide' })

  const userId = req.user.id
  try {
    const [[panier]] = await pool.query('SELECT id FROM paniers WHERE utilisateur_id = :userId LIMIT 1', {
      userId,
    })
    if (!panier?.id) return res.status(404).json({ error: 'Panier introuvable' })

    await pool.query(
      'DELETE FROM panier_articles WHERE panier_id = :panierId AND produit_id = :produitId',
      { panierId: panier.id, produitId },
    )

    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.get('/api/admin/paniers', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id as panierId, p.utilisateur_id as utilisateurId, p.jeton_visiteur as jetonVisiteur,
              p.cree_le as creeLe, u.email as utilisateurEmail,
              COUNT(pa.id) as totalArticles,
              COALESCE(SUM(pa.quantite * pr.prix), 0) as montantEstime
       FROM paniers p
       LEFT JOIN utilisateurs u ON u.id = p.utilisateur_id
       LEFT JOIN panier_articles pa ON pa.panier_id = p.id
       LEFT JOIN produits pr ON pr.id = pa.produit_id
       GROUP BY p.id, p.utilisateur_id, p.jeton_visiteur, p.cree_le, u.email
       ORDER BY p.cree_le DESC
       LIMIT 500`,
    )

    res.json(rows)
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
        throw new Error(`Le produit "${p?.nom || 'Inconnu'}" n'est plus disponible en stock suffisant (${p?.stock_quantite || 0} restants).`)
      }

      total += p.prix * item.quantite
      
      // TRIGGER 3 & 5: Gestion Stock + Alerte Stock Faible
      // Note: On réduit ici pour réserver le stock, mais triggerVente le fait aussi
      // On va laisser triggerVente gérer la réduction finale lors du paiement
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
        'UPDATE produits SET stock_quantite = GREATEST(stock_quantite - :quantite, 0) WHERE id = :produitId',
        {
          produitId: item.produitId,
          quantite: item.quantite,
        },
      )

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
      `DELETE FROM panier_articles
       WHERE panier_id IN (
         SELECT id FROM paniers WHERE utilisateur_id = :userId
       )`,
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
    const publicKey = process.env.MAISHAPAY_PUBLIC_KEY
    
    // Logique ultra-robuste pour l'URL API
    let baseUrl = (process.env.MAISHAPAY_BASE_URL || '').replace(/\/$/, '')
    const isSandboxKey = publicKey && publicKey.includes('SBPK')

    if (!baseUrl) {
      // Priorité aux URLs officielles
      baseUrl = isSandboxKey
        ? 'https://maishapay.online/api/v1/sandbox'
        : 'https://maishapay.online/api/v1'
    } else if (isSandboxKey && !/sandbox/i.test(baseUrl)) {
      // Si une clé sandbox est utilisée, forcer un endpoint sandbox
      baseUrl = `${baseUrl}/sandbox`
    }

    const firstOrigin = resolvePublicAppUrl()

    try {
      console.log(`[MAISHAPAY] Appel API sur ${baseUrl}/transaction/initiate (Ref: ${reference})`)
      
      const payload = {
        api_key: apiKey,
        gateway_key: publicKey,
        merchant_id: merchantId,
        amount: Number(montant),
        currency: 'USD',
        order_id: String(reference),
        description: `Achat Maisha Shop - Réf ${reference}`,
        success_url: `${firstOrigin}/commandes?status=success&ref=${reference}`,
        cancel_url: `${firstOrigin}/paiement?status=cancel`,
      }

      const endpoints = ['transaction/initiate', 'transactions/initiate', 'transaction/initialize']
      let response
      let lastError

      for (const endpoint of endpoints) {
        try {
          console.log(`[MAISHAPAY] Appel API sur ${baseUrl}/${endpoint} (Ref: ${reference})`)
          response = await axios.post(`${baseUrl}/${endpoint}`, payload, {
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              'User-Agent': 'MaishaShop-Express/1.0',
            },
            timeout: 45000,
          })

          // Détection de la réponse : Si c'est du HTML, c'est une erreur 404/500 du serveur MaishaPay
          if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
            console.error('[MAISHAPAY] Le serveur a retourné du HTML au lieu de JSON (Erreur 404/500)')
            throw new Error("Le service Maisha Pay est temporairement indisponible ou l'URL est incorrecte.")
          }

          break
        } catch (err) {
          lastError = err
          const status = err?.response?.status
          if (status === 404 || status === 405) {
            continue
          }
          throw err
        }
      }

      if (!response) {
        throw lastError || new Error("Le service Maisha Pay est temporairement indisponible ou l'URL est incorrecte.")
      }

      const data = response.data
      const pUrl = data.payment_url || data.paymentUrl || (data.response && data.response.payment_url)
      const transId = data.transaction_id || data.transactionId || (data.response && data.response.transaction_id)
      
      if (pUrl) {
        await pool.query(
          `INSERT INTO transactions_paiement (commande_id, reference_externe, montant, mode_paiement, statut, donnees_brutes) 
           VALUES (:cmdId, :extRef, :montant, 'Maisha Pay', 'en_attente', :raw)`,
          { 
            cmdId: commandeId, 
            extRef: transId || reference,
            montant, 
            raw: JSON.stringify(data) 
          }
        )

        return {
          success: true,
          paymentUrl: pUrl,
          transactionId: transId
        }
      } else {
        console.error('[MAISHAPAY ERROR RESPONSE]', data)
        throw new Error(data.message || "La passerelle Maisha Pay n'a pas retourné d'URL de paiement.")
      }
    } catch (error) {
      if (error.response) {
        console.error('[MAISHAPAY API REJECTED]', error.response.status, error.response.data)
        throw new Error(`Maisha Pay : ${error.response.data.message || 'Erreur configuration clés'}`)
      } else if (error.code === 'ECONNABORTED') {
        throw new Error(`Le serveur Maisha Pay est trop lent à répondre (Timeout). Réessayez dans un instant.`)
      } else {
        throw new Error(`Impossible de contacter Maisha Pay : ${error.message}`)
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
    'SELECT id, utilisateur_id, montant_total, statut_paiement, reference FROM commandes WHERE reference = :ref',
    { ref: reference }
  )
  if (cmd) {
    // 1. On vérifie si la vente n'existe pas déjà pour éviter les doublons
    const [[exists]] = await conn.query('SELECT id FROM ventes WHERE reference = :ref', { ref: reference })
    if (!exists) {
      // 2. Enregistrer la vente avec la référence (très important car la commande sera supprimée)
      const [vResult] = await conn.query(
        'INSERT INTO ventes (commande_id, reference, utilisateur_id, montant, date_vente) VALUES (:cid, :ref, :uid, :mt, NOW())',
        { cid: cmd.id, ref: cmd.reference, uid: cmd.utilisateur_id, mt: cmd.montant_total }
      )
      const venteId = vResult.insertId

      // 3. ARCHIVAGE PROFESSIONNEL : Copier les détails des articles avant suppression
      await conn.query(
        `INSERT INTO vente_details (vente_id, produit_id, quantite, prix_unitaire)
         SELECT :venteId, produit_id, quantite, prix_unitaire 
         FROM commande_details WHERE commande_id = :cmdId`,
        { venteId, cmdId: cmd.id }
      )

      // 4. SUPPRESSION AUTOMATIQUE DE LA COMMANDE (Demande utilisateur)
      // La contrainte ON DELETE SET NULL sur ventes.commande_id permet de garder la trace sans casser l'intégrité
      await conn.query('DELETE FROM commandes WHERE id = :id', { id: cmd.id })
      
      console.log(`[TRIGGER CODE] Commande ${reference} transformée en Vente et supprimée du registre actif.`)
    }
  }
}

async function triggerTransactionPaiement(conn, commandeId, options = {}) {
  const source = options.source || 'system'
  const referenceExterne = options.referenceExterne || null
  const rawData = options.rawData ?? null

  const [[cmd]] = await conn.query(
    `SELECT id, reference, montant_total, mode_paiement
     FROM commandes
     WHERE id = :id
     LIMIT 1`,
    { id: Number(commandeId) },
  )

  if (!cmd?.id) return

  const [[existing]] = await conn.query(
    `SELECT id, statut
     FROM transactions_paiement
     WHERE commande_id = :commandeId
     ORDER BY id DESC
     LIMIT 1`,
    { commandeId: cmd.id },
  )

  const payload = JSON.stringify({
    source,
    referenceCommande: cmd.reference,
    event: 'validation_admin_paiement',
    data: rawData,
    occurredAt: new Date().toISOString(),
  })

  if (existing?.id) {
    await conn.query(
      `UPDATE transactions_paiement
       SET montant = :montant,
           devise = 'USD',
           mode_paiement = COALESCE(:modePaiement, mode_paiement),
           statut = 'reussi',
           reference_externe = COALESCE(:referenceExterne, reference_externe, :fallbackReference),
           donnees_brutes = :raw
       WHERE id = :id`,
      {
        id: existing.id,
        montant: cmd.montant_total,
        modePaiement: cmd.mode_paiement ?? null,
        referenceExterne,
        fallbackReference: cmd.reference,
        raw: payload,
      },
    )
    return
  }

  await conn.query(
    `INSERT INTO transactions_paiement
      (commande_id, reference_externe, montant, devise, mode_paiement, statut, donnees_brutes)
     VALUES
      (:commandeId, :referenceExterne, :montant, 'USD', :modePaiement, 'reussi', :raw)`,
    {
      commandeId: cmd.id,
      referenceExterne: referenceExterne || cmd.reference,
      montant: cmd.montant_total,
      modePaiement: cmd.mode_paiement ?? null,
      raw: payload,
    },
  )
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
      try {
        const maishaResult = await MaishaPayService.initiatePayment(montant, commande.reference, commande.commandeId)
        responseData.paymentUrl = maishaResult.paymentUrl
        responseData.message = 'Redirection vers la passerelle de paiement Maisha Pay...'

        await pool.query(
          'INSERT INTO notifications (message, lu) VALUES (:msg, 0)', 
          { msg: `🌐 MAISHA PAY: Nouvelle tentative de paiement pour ${commande.reference} (${montant} USD).` }
        )
      } catch (paymentError) {
        console.warn('[MAISHAPAY] Passage en mode dégradé:', paymentError?.message || paymentError)
        responseData.status = 'success'
        responseData.message = `Commande enregistrée: Maisha Pay est indisponible pour le moment. Réf: ${commande.reference}`
        responseData.paymentUrl = null
      }
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
  const normalizedStatus = String(status || '').toLowerCase()
  const isSuccess = ['success', 'succeeded', 'paid', 'paye', 'reussi', 'completed', 'complete'].includes(normalizedStatus)

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [[commandRow]] = await conn.query(
      'SELECT id, reference FROM commandes WHERE reference = :orderId LIMIT 1',
      { orderId: order_id },
    )
    
    // Mettre à jour la commande
    if (isSuccess && commandRow?.id) {
      await triggerTransactionPaiement(conn, commandRow.id, {
        source: 'maishapay_webhook',
        referenceExterne: transaction_id || null,
        rawData: req.body,
      })

      await conn.query(
        "UPDATE commandes SET statut_paiement = 'paye' WHERE id = :id",
        { id: commandRow.id }
      )
      
      // TRIGGER: Création de vente
      await triggerVente(conn, order_id)

      await conn.query(
        'INSERT INTO notifications (message, lu) VALUES (:msg, 0)', 
        { msg: `✅ PAIEMENT RÉUSSI: La commande ${order_id} a été payée via Maisha Pay.` }
      )
    }

    console.log(`[MAISHAPAY] Webhook traité pour ${order_id}. Statut final: ${status}`)
    await conn.commit()
    if (isSuccess) {
      setImmediate(() => sendInvoice(null, order_id))
    }
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

app.get('/api/notifications/unread-count', requireAuth, async (_req, res) => {
  try {
    const [[row]] = await pool.query('SELECT COUNT(*) as unreadCount FROM notifications WHERE lu = 0')
    res.json({ unreadCount: Number(row?.unreadCount ?? 0) })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.put('/api/notifications/:id/lu', requireAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id invalide' })

  try {
    await pool.query('UPDATE notifications SET lu = 1 WHERE id = :id', { id })
    res.json({ success: true })
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
    let shouldEnsureVente = false

    // 1. Récupérer l'état actuel pour comparer
    const [[oldCmd]] = await conn.query(
      'SELECT id, reference, utilisateur_id, statut_paiement, statut_livraison, montant_total, mode_paiement FROM commandes WHERE id = :id FOR UPDATE',
      { id: commandeId }
    )

    if (!oldCmd) {
      await conn.rollback()
      return res.status(404).json({ error: 'Commande introuvable' })
    }

    // --- LOGIQUE TRANSITION AUTOMATIQUE : PAIEMENT RÉUSSI -> VENTE + ARCHIVAGE ---
    if (statutPaiement === 'paye' && oldCmd.statut_paiement !== 'paye') {
      await triggerTransactionPaiement(conn, oldCmd.id, {
        source: 'admin_validation',
        rawData: {
          adminId: req.user?.id ?? null,
          previousStatus: oldCmd.statut_paiement,
          nextStatus: 'paye',
        },
      })

      // 1. Déclencher le transfert vers 'ventes', archivage articles, et suppression de 'commandes'
      await triggerVente(conn, oldCmd.reference)
      
      await conn.commit()
      
      // 2. Déclenchement de la facture (Email + WhatsApp simulé)
      // Note: On utilise la référence car l'ID de la commande n'existe plus en table active
      setImmediate(() => sendInvoice(null, oldCmd.reference))
      
      return res.json({ 
        success: true, 
        message: 'Félicitations ! La commande a été validée, payée et archivée en tant que vente réussie.' 
      })
    }

    // --- LOGIQUE TRIGGER 7: Paiement ÉCHOUÉ (Notification) ---
    if (statutPaiement === 'echoue' && oldCmd.statut_paiement !== 'echoue') {
      await conn.query(
        "INSERT INTO notifications (message, lu) VALUES (:msg, 0)",
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
        "INSERT INTO notifications (message, lu) VALUES (:msg, 0)",
        { msg: `La commande ${oldCmd.reference} a été annulée. Stock restauré.` }
      )
    }

    // --- LOGIQUE SPÉCIFIQUE LIVRÉ (Vente + Suppression si nécessaire) ---
    if (statutLivraison === 'livre') {
      // Si on marque comme livré, on s'assure que la vente existe (idempotent)
      await triggerVente(conn, oldCmd.reference)
      
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

    if (shouldEnsureVente) {
      await triggerVente(conn, oldCmd.reference)
      await triggerTransactionPaiement(conn, oldCmd.id, {
        source: 'admin_validation',
        rawData: {
          adminId: req.user?.id ?? null,
          previousStatus: oldCmd.statut_paiement,
          nextStatus: 'paye',
        },
      })
    }

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
  imageUrl: z.string().max(8_000_000),
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
  const sanitizedBannerImage = sanitizeProductImageUrl(body.imageUrl)
  if (!sanitizedBannerImage) {
    return res.status(400).json({
      error: "Image bannière invalide. Utilisez une URL http(s), un chemin '/media/...', ou un import local."
    })
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO bannieres (titre, image_url, lien_redirection, actif)
       VALUES (:titre, :imageUrl, :lienRedirection, :actif)`,
      {
        titre: body.titre,
        imageUrl: sanitizedBannerImage,
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

app.get('/api/admin/ventes', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT v.id, v.commande_id as commandeId, v.reference, v.montant, v.date_vente as dateVente,
              u.email as clientEmail, u.nom as clientNom, u.prenom as clientPrenom
       FROM ventes v
       LEFT JOIN utilisateurs u ON v.utilisateur_id = u.id
       ORDER BY v.date_vente DESC`
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// --- GESTION UTILISATEURS (ADMIN) ---
app.get('/api/admin/utilisateurs', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, email, nom, prenom, telephone, role, date_inscription as dateInscription
       FROM utilisateurs
       ORDER BY date_inscription DESC`
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.put('/api/admin/utilisateurs/:id/role', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params
  const { role } = req.body
  if (!['client', 'admin'].includes(role)) {
    return res.status(400).json({ error: "Rôle invalide" })
  }
  try {
    await pool.query("UPDATE utilisateurs SET role = :role WHERE id = :id", { role, id })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.delete('/api/admin/utilisateurs/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params
  try {
    // Ne pas permettre de supprimer soi-même
    if (Number(id) === req.user.id) {
      return res.status(400).json({ error: "Impossible de supprimer votre propre compte admin" })
    }
    await pool.query("DELETE FROM utilisateurs WHERE id = :id", { id })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// --- GESTION DETAILS COMMANDES ---
app.get('/api/commandes/:id/details', requireAuth, async (req, res) => {
  const { id } = req.params
  try {
    // Vérifier si la commande appartient à l'utilisateur ou si c'est un admin
    const [[commande]] = await pool.query("SELECT utilisateur_id FROM commandes WHERE id = :id", { id })
    if (!commande) return res.status(404).json({ error: "Commande introuvable" })
    
    if (req.user.role !== 'admin' && commande.utilisateur_id !== req.user.id) {
      return res.status(403).json({ error: "Accès refusé" })
    }

    const [rows] = await pool.query(
      `SELECT cd.*, p.nom as produitNom, p.image_principale as imagePrincipale
       FROM commande_details cd
       JOIN produits p ON cd.produit_id = p.id
       WHERE cd.commande_id = :id`,
      { id }
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// --- CHATBOT IA INTELLIGENT ---
app.post('/api/chatbot', async (req, res) => {
  const { message } = req.body
  const msg = String(message || '').toLowerCase()

  try {
    if (isGreetingMessage(msg) || isThanksMessage(msg) || isGoodbyeMessage(msg)) {
      return res.json({ reply: fallbackChatbotReply(message) })
    }

    const projectContextMatches = await collectProjectContext(message)
    const projectContext = formatProjectContext(projectContextMatches)

    if (msg.includes('cmd-') || msg.includes('commande') || msg.includes('livraison')) {
      const refMatch = msg.match(/cmd-[a-z0-9]+/i)
      if (refMatch) {
        const [cmd] = await pool.query(
          `SELECT c.statut_paiement, c.statut_livraison, c.montant_total, u.prenom 
           FROM commandes c 
           JOIN utilisateurs u ON c.utilisateur_id = u.id 
           WHERE c.reference = :ref`,
          { ref: refMatch[0].toUpperCase() }
        )
        if (cmd.length > 0) {
          const c = cmd[0]
          return res.json({
            reply: `Bonjour ${c.prenom} ! Voici l'état de votre commande *${refMatch[0].toUpperCase()}* :\n\n💰 *Total* : ${Number(c.montant_total).toFixed(2)} USD\n💳 *Paiement* : ${c.statut_paiement}\n🚚 *Livraison* : ${c.statut_livraison}\n\nUne équipe s'en occupe activement !`,
          })
        }
      }
      return res.json({ reply: "Pour suivre précisément votre colis, merci de m'indiquer la référence de commande (ex: CMD-XXXXX)." })
    }

    if (msg.includes('produit') || msg.includes('vend') || msg.includes('achat') || msg.includes('stock') || msg.includes('montre-moi') || msg.includes('cherche')) {
      const [products] = await pool.query(
        'SELECT p.nom, p.prix, p.stock_quantite, c.nom as categorie FROM produits p JOIN categories c ON p.categorie_id = c.id WHERE p.stock_quantite > 0 AND (p.nom LIKE :q OR p.description LIKE :q) LIMIT 5',
        { q: `%${msg.replace(/produit|cherche|vend|montre-moi/g, '').trim()}%` }
      )

      if (products.length > 0) {
        const list = products.map((p) => `✨ *${p.nom}*\n   Prix: ${Number(p.prix).toFixed(2)} USD\n   Catégorie: ${p.categorie}`).join('\n\n')
        return res.json({
          reply: `Bienvenue chez Maisha Shop ! J'ai trouvé ces articles pour vous :\n\n${list}\n\nSouhaitez-vous que je les ajoute à votre panier ?`,
        })
      }
    }

    if (msg.includes('categorie') || msg.includes('rayon') || msg.includes('genre')) {
      const [categories] = await pool.query('SELECT nom, description FROM categories WHERE statut = 1')
      const list = categories.map((c) => `📂 *${c.nom}* : ${c.description || 'Découvrez nos nouveautés'}`).join('\n')
      return res.json({ reply: `Nous avons plusieurs rayons disponibles :\n\n${list}` })
    }

    try {
      const geminiReply = await askGemini(message, projectContext)
      if (geminiReply) {
        return res.json({ reply: geminiReply })
      }
    } catch (geminiError) {
      console.warn('[CHATBOT GEMINI] fallback local', geminiError?.message || geminiError)
    }

    return res.json({ reply: projectContext ? `Voici ce que j'ai trouvé dans le projet :\n\n${projectContext}\n\n${fallbackChatbotReply(message)}` : fallbackChatbotReply(message) })

  } catch (e) {
    console.error('[CHATBOT ERROR]', e)
    res.status(500).json({ reply: "Désolé, mon cerveau numérique surchauffe... 🧠🔥 Réessayez dans un instant !" })
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
    const dateObj = new Date(commande.date_commande)
    const dateStr = dateObj.toLocaleDateString('fr-FR');
    const invoiceUrl = `${BASE_URL}/api/factures/${commande.reference}`

    const [[dailyCommandes]] = await pool.query(
      `SELECT COUNT(*) as totalCommandes, COALESCE(SUM(montant_total), 0) as totalMontant
       FROM commandes
       WHERE DATE(date_commande) = DATE(:dateCommande)`,
      { dateCommande: commande.date_commande }
    )

    const [[dailyVentes]] = await pool.query(
      `SELECT COUNT(*) as totalVentes, COALESCE(SUM(montant), 0) as totalMontant
       FROM ventes
       WHERE DATE(date_vente) = DATE(:dateCommande)`,
      { dateCommande: commande.date_commande }
    )

    const qrDataUrl = await QRCode.toDataURL(invoiceUrl, {
      width: 180,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })

    const html = `
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
              .qr-box { display: flex; flex-direction: column; align-items: center; gap: 6px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; background: #f8fafc; }
              .qr-box img { width: 120px; height: 120px; }
              .qr-caption { font-size: 12px; color: #64748b; text-align: center; }
              table { width: 100%; line-height: inherit; text-align: left; border-collapse: collapse; }
              th { background: #f8fafc; padding: 12px; border-bottom: 2px solid #eee; }
              .total { margin-top: 30px; text-align: right; font-size: 20px; font-weight: bold; color: #1e293b; }
              .report { margin-top: 24px; padding: 18px; border-radius: 12px; background: #f1f5f9; border: 1px solid #e2e8f0; }
              .report h3 { margin: 0 0 12px; font-size: 16px; color: #0f172a; }
              .report-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
              .report-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
              .report-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
              .report-value { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 4px; }
              .footer { margin-top: 50px; text-align: center; color: #64748b; font-size: 14px; }
              @media print { body { background: none; padding: 0; } .invoice-box { box-shadow: none; border: none; } .no-print { display: none; } }
              @media (max-width: 720px) { .header { flex-direction: column; align-items: flex-start; } .invoice-info { text-align: left; } .report-grid { grid-template-columns: 1fr; } }
          </style>
      </head>
      <body>
          <div class="invoice-box">
              <div class="header">
                  <div>
                      <div class="logo">MAISHA SHOP</div>
                      <div style="font-size: 14px; color: #64748b; margin-top: 4px;">
                          Email: support@maishashop.com<br>
                          Tél: +243 999 000 111
                      </div>
                  </div>
                  <div class="invoice-info">
                      <strong>Facture #:</strong> ${commande.reference}<br>
                      <strong>Date:</strong> ${dateStr}
                  </div>
                  <div class="qr-box">
                      <img src="${qrDataUrl}" alt="QR Facture" />
                      <div class="qr-caption">Scanner pour ouvrir<br>la facture en ligne</div>
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

              <div class="report">
                  <h3>Rapport global du ${dateStr}</h3>
                  <div class="report-grid">
                      <div class="report-card">
                          <div class="report-label">Commandes du jour</div>
                          <div class="report-value">${Number(dailyCommandes?.totalCommandes || 0)} commandes</div>
                          <div class="report-label" style="margin-top:8px;">Montant cumulé</div>
                          <div class="report-value">${Number(dailyCommandes?.totalMontant || 0).toFixed(2)} USD</div>
                      </div>
                      <div class="report-card">
                          <div class="report-label">Ventes du jour</div>
                          <div class="report-value">${Number(dailyVentes?.totalVentes || 0)} ventes</div>
                          <div class="report-label" style="margin-top:8px;">Montant encaissé</div>
                          <div class="report-value">${Number(dailyVentes?.totalMontant || 0).toFixed(2)} USD</div>
                      </div>
                  </div>
              </div>

              <div class="footer">
                  <p>Merci pour votre achat !</p>
                  <p>Mode de paiement : ${commande.mode_paiement}</p>
                  <button class="no-print" onclick="window.print()" style="margin-top:20px; padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 5px; cursor: pointer;">Imprimer la facture</button>
              </div>
          </div>
      </body>
      </html>
    `;

    if (req.query.download === 'true' || req.query.format === 'pdf') {
      const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
      })
      await browser.close()
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="facture-${commande.reference}.pdf"`)
      return res.send(pdfBuffer)
    }

    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur lors de la génération de la facture');
  }
});

app.get('/api/admin/rapport-commandes/pdf', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const [commandes] = await pool.query(`
      SELECT c.*, u.email, u.nom, u.prenom
      FROM commandes c
      JOIN utilisateurs u ON c.utilisateur_id = u.id
      ORDER BY c.date_commande DESC
    `);

    const [[stats]] = await pool.query(`
      SELECT 
        COUNT(*) as totalCommandes, 
        SUM(montant_total) as totalMontant,
        SUM(CASE WHEN statut_livraison = 'livré' THEN 1 ELSE 0 END) as totalLivrees
      FROM commandes
    `);

    const rowsHtml = commandes.map(c => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${c.reference}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${new Date(c.date_commande).toLocaleDateString('fr-FR')}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${c.prenom || ''} ${c.nom || ''}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${Number(c.montant_total).toFixed(2)} $</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">
          <span style="padding: 4px 8px; border-radius: 4px; font-size: 11px; background: #f1f5f9;">${c.statut_livraison}</span>
        </td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <style>
              body { font-family: 'Segoe UI', sans-serif; color: #333; padding: 40px; }
              .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; }
              .logo { font-size: 24px; font-weight: bold; color: #3b82f6; }
              .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 30px 0; }
              .stat-card { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
              .stat-label { font-size: 12px; color: #64748b; text-transform: uppercase; }
              .stat-value { font-size: 20px; font-weight: bold; color: #0f172a; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th { text-align: left; background: #f1f5f9; padding: 12px 8px; font-size: 13px; text-transform: uppercase; color: #64748b; }
              td { font-size: 13px; }
          </style>
      </head>
      <body>
          <div class="header">
              <div>
                  <div class="logo">MAISHA SHOP - RAPPORT</div>
                  <div style="font-size: 14px; color: #64748b; margin-top: 4px;">Rapport Complet des Commandes</div>
              </div>
              <div style="text-align: right;">
                  <strong>Date:</strong> ${new Date().toLocaleDateString('fr-FR')}<br>
                  <strong>Heure:</strong> ${new Date().toLocaleTimeString('fr-FR')}
              </div>
          </div>

          <div class="summary">
              <div class="stat-card">
                  <div class="stat-label">Total Commandes</div>
                  <div class="stat-value">${stats.totalCommandes || 0}</div>
              </div>
              <div class="stat-card">
                  <div class="stat-label">Chiffre d'Affaires</div>
                  <div class="stat-value">${Number(stats.totalMontant || 0).toFixed(2)} USD</div>
              </div>
              <div class="stat-card">
                  <div class="stat-label">Commandes Livrées</div>
                  <div class="stat-value">${stats.totalLivrees || 0}</div>
              </div>
          </div>

          <table>
              <thead>
                  <tr>
                      <th>Référence</th>
                      <th>Date</th>
                      <th>Client</th>
                      <th style="text-align: right;">Montant</th>
                      <th style="text-align: center;">Statut</th>
                  </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
          </table>
      </body>
      </html>
    `;

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
    });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="rapport-global-commandes.pdf"');
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur lors de la génération du rapport PDF');
  }
});

// --- SERVIR LE FRONTEND (SPA) ---
const distPath = path.join(__dirname, '../dist')
const publicPath = path.join(__dirname, '../public')

// 1. Servir les fichiers statiques (JS, CSS, Images)
app.use('/media', express.static(path.join(publicPath, 'media')))
app.use(express.static(distPath))

// 2. Fallback SPA (compatible Express 5): middleware sans pattern wildcard
app.use((req, res) => {
  // Si la requête commence par /api, c'est une 404 API (pas trouvé ci-dessus)
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint API introuvable' })
  }
  // Sinon, on envoie le fichier index.html du build React
  res.sendFile(path.join(distPath, 'index.html'))
})

export default app
