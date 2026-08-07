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

// Setup uploads folder
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve public static folder
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer storage for PIC CRM photos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'pic-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
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

// Helper to sync local database submission to Google Sheets Web App asynchronously
async function syncToWebAppAsync(dealerCode, record) {
  if (!record) return;

  const payload = { ...record };

  // Convert photo to base64 Data URL for Google Sheets Web App upload
  if (payload.fotoPicCrm && payload.fotoPicCrm.startsWith('/uploads/')) {
    const filePath = path.join(__dirname, 'public', payload.fotoPicCrm);
    if (fs.existsSync(filePath)) {
      try {
        const fileBuffer = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        let mimeType = 'image/png';
        if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
        else if (ext === '.webp') mimeType = 'image/webp';
        else if (ext === '.gif') mimeType = 'image/gif';

        payload.fotoPicCrm = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
      } catch (err) {
        console.error(`[Google Web App Sync] Failed to read photo file for base64 conversion:`, err);
      }
    }
  }

  try {
    const bodyParams = new URLSearchParams();
    bodyParams.append('action', 'saveRecord');
    bodyParams.append('payload', JSON.stringify(payload));

    const response = await fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyParams.toString()
    });

    const result = await response.json();
    if (result.ok) {
      console.log(`[Google Web App Sync] Successfully synced record for dealer ${dealerCode}`);
    } else {
      console.error(`[Google Web App Sync] Failed to sync record for dealer ${dealerCode}:`, result);
    }
  } catch (err) {
    console.error(`[Google Web App Sync] Network error syncing dealer ${dealerCode}:`, err.message);
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
app.post('/api/submit', authenticate, upload.single('fotoPicCrm'), (req, res) => {
  if (req.user.role === 'admin') {
    return res.status(400).json({ error: 'Admin tidak dapat mengisi form dealer.' });
  }

  const dealerCode = req.user.code;
  const existingSubmission = db.getSubmission(dealerCode) || {};

  // Form fields parsed from req.body
  const formData = { ...req.body };

  // Set file path if uploaded, otherwise retain existing
  if (req.file) {
    formData.fotoPicCrm = '/uploads/' + req.file.filename;
  } else if (existingSubmission.fotoPicCrm) {
    formData.fotoPicCrm = existingSubmission.fotoPicCrm;
  } else {
    formData.fotoPicCrm = ''; // Default empty if none
  }

  // Ensure terms/checklist is marked
  formData.consentAccepted = formData.consentAccepted === 'true' || formData.consentAccepted === true;

  // Save submission to local database (cache/primary source of truth for homepage)
  const success = db.saveSubmission(dealerCode, formData);

  if (success) {
    // Sync to Google Sheets Web App asynchronously in the background
    syncToWebAppAsync(dealerCode, db.getSubmission(dealerCode))
      .catch(err => console.error('Error in background sync to Google Web App:', err));

    res.json({
      success: true,
      message: 'Form data berhasil dikirim.',
      data: db.getSubmission(dealerCode)
    });
  } else {
    res.status(500).json({ error: 'Gagal menyimpan data form secara lokal.' });
  }
});

// 5. API: Get all submissions (Admin dashboard)
app.get('/api/submissions', authenticate, requireAdmin, (req, res) => {
  const submissions = db.getAllSubmissions();
  const sheetsConfig = googleSheets.getConfigPublic();
  res.json({
    submissions: submissions,
    dealersList: db.DEALERS,
    spreadsheetUrl: sheetsConfig.spreadsheetUrl
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
