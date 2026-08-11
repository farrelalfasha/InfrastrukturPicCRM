const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const googleSheets = require('./googleSheets');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Parse JSON and form urlencoded payloads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve public static folder
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// PENTING: Vercel (dan platform serverless lain) TIDAK mengizinkan
// menulis file ke disk secara permanen — hanya folder /tmp yang bisa
// ditulis, dan isinya hilang begitu function selesai dieksekusi.
// Karena itu foto PIC CRM diproses langsung di MEMORI (bukan ditulis
// ke folder public/uploads), lalu dikonversi ke base64 untuk dikirim
// ke Google Sheets Web App. Ini membuat aplikasi tetap berfungsi baik
// di localhost maupun di Vercel tanpa perlu folder uploads sama sekali.
// ============================================================
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|webp|gif/;
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    if (allowedTypes.test(ext) && allowedTypes.test(mime)) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diperbolehkan!'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Middleware to verify authorization token
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Token otorisasi diperlukan.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Format token salah.' });
  }

  const cleanToken = token.toUpperCase();
  if (cleanToken === 'MAINDEALER') {
    req.user = { role: 'admin', code: 'MAINDEALER' };
    return next();
  }

  if (db.isValidDealer(cleanToken)) {
    const dealer = db.getDealerDetails(cleanToken);
    req.user = { role: 'dealer', code: cleanToken, name: dealer.name };
    return next();
  }

  return res.status(403).json({ error: 'Token/Kode tidak valid.' });
}

// Admin only middleware
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Akses ditolak. Hanya untuk Main Dealer / Admin.' });
  }
}

// 1. API: Login
app.post('/api/login', (req, res) => {
  const { code, password } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Kode login diperlukan.' });
  }
  if (!password) {
    return res.status(400).json({ error: 'Kata sandi (password) diperlukan.' });
  }

  const cleanCode = code.trim().toUpperCase();
  const cleanPassword = password.trim();

  // Admin login check
  if (cleanCode === 'MAINDEALER') {
    if (cleanPassword === 'crm12345*' || cleanPassword === 'admin12345*') {
      return res.json({
        success: true,
        token: 'MAINDEALER',
        role: 'admin',
        name: 'PT. Daya Adicipta Motora'
      });
    } else {
      return res.status(400).json({ error: 'Kata sandi admin salah.' });
    }
  }

  // Dealer login check
  if (db.isValidDealer(cleanCode)) {
    const expectedPassword = `${cleanCode.toLowerCase()}_crm123`;
    if (cleanPassword === expectedPassword) {
      const dealer = db.getDealerDetails(cleanCode);
      return res.json({
        success: true,
        token: cleanCode,
        role: 'dealer',
        name: dealer.name,
        code: cleanCode
      });
    } else {
      return res.status(400).json({ error: 'Kata sandi dealer salah' });
    }
  }

  return res.status(400).json({ error: 'Kode dealer tidak terdaftar.' });
});

// 2. API: Get dealer list (for dropdowns)
app.get('/api/dealers', (req, res) => {
  res.json({
    dealers: db.DEALERS,
    codes: db.DEALER_CODES
  });
});

const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyTIsyMk0-o7v60vi48tY5V9JrdFEj3ZO6G2LoeKLKb-eFe5vzy2FruB8LKskywwQit5A/exec';

// Sync a submission to the Google Sheets Web App.
// Returns true/false so the caller can know whether it actually succeeded —
// this is now the REAL source of truth for whether a submission "worked",
// since local file writes are not reliable on serverless hosts like Vercel.
async function syncToWebAppAsync(dealerCode, record) {
  if (!record) return false;

  try {
    const bodyParams = new URLSearchParams();
    bodyParams.append('action', 'saveRecord');
    bodyParams.append('payload', JSON.stringify(record));

    const response = await fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyParams.toString()
    });

    const result = await response.json();
    if (result.ok) {
      console.log(`[Google Web App Sync] Successfully synced record for dealer ${dealerCode}`);
      return true;
    } else {
      console.error(`[Google Web App Sync] Failed to sync record for dealer ${dealerCode}:`, result);
      return false;
    }
  } catch (err) {
    console.error(`[Google Web App Sync] Network error syncing dealer ${dealerCode}:`, err.message);
    return false;
  }
}

// 3. API: Get dealer status & form data
app.get('/api/dealer/status', authenticate, (req, res) => {
  if (req.user.role === 'admin') {
    return res.status(400).json({ error: 'Endpoint ini hanya untuk dealer.' });
  }

  const submission = db.getSubmission(req.user.code);
  res.json({
    code: req.user.code,
    name: req.user.name,
    submitted: !!submission,
    data: submission
  });
});

// 4. API: Submit form data (multipart form upload)
app.post('/api/submit', authenticate, upload.single('fotoPicCrm'), async (req, res) => {
  if (req.user.role === 'admin') {
    return res.status(400).json({ error: 'Admin tidak dapat mengisi form dealer.' });
  }

  const dealerCode = req.user.code;
  const existingSubmission = db.getSubmission(dealerCode) || {};

  // Form fields parsed from req.body
  const formData = { ...req.body };

  // Convert uploaded photo (in memory, never touches disk) to base64 data URL
  if (req.file) {
    const mimeType = req.file.mimetype || 'image/jpeg';
    formData.fotoPicCrm = `data:${mimeType};base64,${req.file.buffer.toString('base64')}`;
  } else if (existingSubmission.fotoPicCrm) {
    formData.fotoPicCrm = existingSubmission.fotoPicCrm;
  } else {
    formData.fotoPicCrm = '';
  }

  // Ensure terms/checklist is marked
  formData.consentAccepted = formData.consentAccepted === 'true' || formData.consentAccepted === true;

  const recordToSync = {
    ...existingSubmission,
    ...formData,
    code: dealerCode,
    timestamp: new Date().toISOString()
  };

  // Best-effort local cache save. This WILL fail on read-only filesystems
  // like Vercel — that's expected and no longer treated as a fatal error.
  let localSaveOk = false;
  try {
    localSaveOk = db.saveSubmission(dealerCode, formData);
  } catch (err) {
    console.error('[Local Save] Failed (expected on Vercel/serverless):', err.message);
  }

  // Google Sheets is the real source of truth now — we WAIT for the result
  // instead of firing it in the background, so we can report true success/failure.
  const sheetsOk = await syncToWebAppAsync(dealerCode, recordToSync);

  if (localSaveOk || sheetsOk) {
    return res.json({
      success: true,
      message: 'Form data berhasil dikirim.',
      data: recordToSync
    });
  }

  return res.status(500).json({
    error: 'Gagal mengirim data form. Cek koneksi internet dan coba lagi dalam beberapa saat.'
  });
});

// Fetch every submission straight from Google Sheets (the real source of
// truth) and group it by dealer code, keeping only the latest row per
// dealer if there happen to be duplicates (each submit appends a new row).
async function fetchSubmissionsFromSheets() {
  const bodyParams = new URLSearchParams();
  bodyParams.append('action', 'listRecords');

  const response = await fetch(WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString()
  });

  const result = await response.json();
  if (!result.ok || !Array.isArray(result.records)) {
    throw new Error('Respons listRecords dari Google Sheets tidak valid.');
  }

  // Sort newest first so the first occurrence per dealer code we keep is the latest
  const sorted = result.records
    .slice()
    .sort((a, b) => new Date(b.submittedAt || b.timestamp || 0) - new Date(a.submittedAt || a.timestamp || 0));

  const byCode = {};
  for (const record of sorted) {
    const code = record.code || record.kodeDealer;
    if (code && !byCode[code]) {
      byCode[code] = record;
    }
  }
  return byCode;
}

// 5. API: Get all submissions (Admin dashboard)
app.get('/api/submissions', authenticate, requireAdmin, async (req, res) => {
  const sheetsConfig = googleSheets.getConfigPublic();

  try {
    const submissions = await fetchSubmissionsFromSheets();
    return res.json({
      submissions: submissions,
      dealersList: db.DEALERS,
      spreadsheetUrl: sheetsConfig.spreadsheetUrl
    });
  } catch (err) {
    console.error('[Dashboard] Failed to fetch from Google Sheets, falling back to local cache:', err.message);
    // Fallback only used if Google Sheets is unreachable (e.g. local dev without internet)
    const submissions = db.getAllSubmissions();
    return res.json({
      submissions: submissions,
      dealersList: db.DEALERS,
      spreadsheetUrl: sheetsConfig.spreadsheetUrl
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});