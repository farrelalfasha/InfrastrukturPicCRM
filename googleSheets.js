const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const CONFIG_PATH = path.join(__dirname, 'data', 'google-config.json');

// Helper to load config safely
function getConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const content = fs.readFileSync(CONFIG_PATH, 'utf8');
      const config = JSON.parse(content);
      // Check if credentials and fields are configured (not placeholders)
      if (config.spreadsheetId && config.spreadsheetId !== 'MASUKKAN_SPREADSHEET_ID_DISINI' &&
          config.credentials && config.credentials.client_email &&
          config.credentials.client_email !== 'MASUKKAN_EMAIL_SERVICE_ACCOUNT_DISINI') {
        return config;
      }
    }
  } catch (error) {
    console.error('Error reading google-config.json:', error);
  }
  return null;
}

// Return public info (e.g. spreadsheetUrl) for the frontend
function getConfigPublic() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const content = fs.readFileSync(CONFIG_PATH, 'utf8');
      const config = JSON.parse(content);
      if (config.spreadsheetUrl && config.spreadsheetUrl !== 'MASUKKAN_URL_SPREADSHEET_LENGKAP_DISINI' && config.spreadsheetUrl !== '') {
        return { spreadsheetUrl: config.spreadsheetUrl };
      }
    }
  } catch (error) {
    console.error('Error reading google-config.json for public config:', error);
  }
  return { spreadsheetUrl: '' };
}

async function syncSubmission(dealerCode, data, originUrl) {
  const config = getConfig();
  if (!config) {
    console.warn(`[Google Sheets] Skip sync for dealer ${dealerCode}: google-config.json not configured or incomplete.`);
    return false;
  }

  try {
    const { spreadsheetId, sheetName, credentials } = config;

    // Standardize private key formatting (service account JSON files have newlines)
    const privateKey = credentials.private_key.replace(/\\n/g, '\n');

    // Authenticate with Google API
    const auth = new google.auth.JWT(
      credentials.client_email,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Fetch existing sheet data to check for dealer code row
    let rows = [];
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:B`, // We only need the first two columns to search for Kode Dealer (Col B)
      });
      rows = response.data.values || [];
    } catch (err) {
      // If error occurs, it might be because the sheet does not exist or sheetName is incorrect.
      // If it's a 400 error (e.g. range not found), we can try to initialize headers.
      console.warn(`[Google Sheets] Could not read range "${sheetName}!A:B", attempting to initialize sheet.`, err.message);
    }

    // 2. Prepare headers with exact label questions from form
    const headers = [
      'Waktu Pengisian (Timestamp)',
      'Kode Dealer',
      'Nama Dealer',
      'Nama Kepala Cabang',
      'Honda ID Kepala Cabang',
      'No HP Kepala Cabang',
      'Email Kepala Cabang',
      'Nama Kepala Bengkel',
      'Honda ID Kepala Bengkel',
      'No HP Kepala Bengkel',
      'Email Kepala Bengkel',
      'Nama PIC CRM',
      'Honda ID PIC CRM',
      'No Telp / HP PIC CRM',
      'Email PIC CRM',
      'Status PIC CRM',
      'Tanggal Lahir PIC CRM',
      'Usia saat ini (Tahun)',
      'Lama Bekerja sebagai PIC CRM',
      'Pendidikan Terakhir PIC CRM',
      'Foto PIC CRM (URL)',
      'Apakah Dealer Memiliki Admin CRM H2?',
      'Nama Admin CRM H2 & Honda ID',
      'No Telp / HP Admin CRM H2',
      'Email Admin CRM H2',
      'Status Kerja Admin CRM H2',
      'Usia Admin H2 Saat Ini',
      'Lama Bekerja sebagai Admin H2',
      'Pendidikan Terakhir Admin H2',
      'Apakah Dealer Memiliki Admin CRM H1?',
      'Nama Admin CRM H1 & Honda ID',
      'No HP Admin CRM H1',
      'Email Admin CRM H1',
      'Status Kerja Admin CRM H1',
      'Usia Admin H1 Saat Ini',
      'Lama Bekerja sebagai Admin H1',
      'Pendidikan Terakhir Admin CRM H1',
      'Dealer memiliki Apps WA Blast?',
      'Aplikasi WA Blast yang digunakan oleh dealer?',
      'No WA yang dipakai untuk Broadcast oleh Dealer?',
      'Status No WA Broadcast?',
      'Apakah No WA tersebut merupakan WA Business?',
      'Bagaimana Cara Dealer Melakukan Broadcast Customer Saat Ini? (WhatsApp)',
      'Dealer memiliki apps sms broadcast?',
      'Sebutkan Apps SMS Broadcast yang digunakan dealer?',
      'Bagaimana Cara Dealer Melakukan Broadcast Customer Saat Ini ? (SMS)'
    ];

    // Format fields for the spreadsheet row
    const rowValues = [
      new Date(data.timestamp || new Date()).toLocaleString('id-ID'),
      dealerCode,
      data.namaDealer || '',
      data.namaKacab || '',
      data.hondaIdKacab || '',
      data.noHpKacab || '',
      data.emailKacab || '',
      data.namaKabeng || '',
      data.hondaIdKabeng || '',
      data.noHpKabeng || '',
      data.emailKabeng || '',
      data.namaPicCrm || '',
      data.hondaIdPic || '',
      data.noHpPic || '',
      data.emailPic || '',
      data.statusPic || '',
      data.tanggalLahirPic || '',
      data.usiaPic || '',
      data.lamaKerjaPic || '',
      data.pendidikanPic || '',
      data.fotoPicCrm ? `${originUrl || ''}${data.fotoPicCrm}` : '',
      data.punyaAdminH2 || 'Tidak',
      data.namaAdminH2 || '',
      data.noHpAdminH2 || '',
      data.emailAdminH2 || '',
      data.statusAdminH2 || '',
      data.usiaAdminH2 || '',
      data.lamaKerjaAdminH2 || '',
      data.pendidikanAdminH2 || '',
      data.punyaAdminH1 || 'Tidak',
      data.namaAdminH1 || '',
      data.noHpAdminH1 || '',
      data.emailAdminH1 || '',
      data.statusAdminH1 || '',
      data.usiaAdminH1 || '',
      data.lamaKerjaAdminH1 || '',
      data.pendidikanAdminH1 || '',
      data.punyaWaBlast || 'Tidak',
      data.appsWaBlast || '',
      data.noWaBroadcast || '',
      data.statusNoWaBroadcast || '',
      data.isWaBusiness || 'Tidak',
      data.caraBroadcastWa || '',
      data.punyaSmsBroadcast || 'Tidak',
      data.appsSmsBroadcast || '',
      data.caraBroadcastSms || ''
    ];

    // 3. Check if we need to write headers
    if (rows.length === 0) {
      // First, write the header row
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [headers] }
      });
      // Append the first data row
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:A`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowValues] }
      });
      console.log(`[Google Sheets] Successfully initialized sheet and synced dealer ${dealerCode}`);
      return true;
    }

    // 4. Search for the row containing dealerCode in column B (index 1)
    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][1] === dealerCode) {
        rowIndex = i + 1; // google sheets uses 1-based indexing
        break;
      }
    }

    if (rowIndex !== -1) {
      // Row exists: overwrite it!
      const range = `${sheetName}!A${rowIndex}:AT${rowIndex}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowValues] }
      });
      console.log(`[Google Sheets] Successfully updated row ${rowIndex} for dealer ${dealerCode}`);
    } else {
      // Row does not exist: append new row!
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:A`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowValues] }
      });
      console.log(`[Google Sheets] Successfully appended new row for dealer ${dealerCode}`);
    }
    return true;
  } catch (error) {
    console.error(`[Google Sheets] Failed to sync dealer ${dealerCode}:`, error);
    return false;
  }
}

module.exports = {
  getConfigPublic,
  syncSubmission
};
