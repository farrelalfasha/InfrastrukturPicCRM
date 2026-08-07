const fs = require('fs');
const path = require('path');

const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyTIsyMk0-o7v60vi48tY5V9JrdFEj3ZO6G2LoeKLKb-eFe5vzy2FruB8LKskywwQit5A/exec';
const DATA_FILE = path.join(__dirname, 'data', 'submissions.json');

async function migrate() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error('File database lokal data/submissions.json tidak ditemukan.');
    return;
  }

  let submissions;
  try {
    submissions = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (error) {
    console.error('Gagal membaca file database lokal:', error);
    return;
  }

  const codes = Object.keys(submissions);
  console.log(`Menemukan ${codes.length} data pengisian dealer lokal untuk dimigrasikan.`);
  console.log(`Menghubungkan ke Google Sheets Web App URL: ${WEB_APP_URL}\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    const data = { ...submissions[code] };
    console.log(`[${i + 1}/${codes.length}] Memproses dealer ${code}...`);

    // Konversi file foto lokal menjadi base64 jika ada
    if (data.fotoPicCrm && data.fotoPicCrm.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, 'public', data.fotoPicCrm);
      if (fs.existsSync(filePath)) {
        try {
          const fileBuffer = fs.readFileSync(filePath);
          const ext = path.extname(filePath).toLowerCase();
          let mimeType = 'image/png';
          if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
          else if (ext === '.webp') mimeType = 'image/webp';
          else if (ext === '.gif') mimeType = 'image/gif';
          
          data.fotoPicCrm = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
          console.log(`   -> Berhasil mengonversi foto lokal ke base64.`);
        } catch (e) {
          console.error(`   -> Gagal membaca file foto ${data.fotoPicCrm}:`, e.message);
        }
      } else {
        console.warn(`   -> File foto lokal ${data.fotoPicCrm} tidak ditemukan secara fisik.`);
      }
    }

    try {
      const bodyParams = new URLSearchParams();
      bodyParams.append('action', 'saveRecord');
      bodyParams.append('payload', JSON.stringify({
        ...data,
        code: code
      }));

      const res = await fetch(WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString()
      });

      const result = await res.json();
      if (result.ok) {
        console.log(`   -> Berhasil disimpan ke Google Sheets.`);
        successCount++;
      } else {
        console.error(`   -> Gagal menyimpan ke Google Sheets:`, result);
        failCount++;
      }
    } catch (e) {
      console.error(`   -> Gagal melakukan request:`, e.message);
      failCount++;
    }
  }

  console.log('\n--- Hasil Migrasi ---');
  console.log(`Berhasil dikirim : ${successCount}`);
  console.log(`Gagal/Dilewati   : ${failCount}`);
  console.log('---------------------');
  console.log('Selesai.');
}

migrate();
