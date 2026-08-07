const db = require('./database');
const googleSheets = require('./googleSheets');

async function syncAll() {
  const submissions = db.getAllSubmissions();
  const codes = Object.keys(submissions);
  
  console.log(`Menemukan ${codes.length} data pengisian dealer yang terdaftar di database lokal.`);
  console.log('Memulai proses sinkronisasi ke Google Sheets...\n');

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    const data = submissions[code];
    console.log(`[${i + 1}/${codes.length}] Sinkronisasi dealer ${code}...`);
    
    // Gunakan origin localhost default untuk link foto
    const originUrl = 'http://localhost:3000';
    try {
      const success = await googleSheets.syncSubmission(code, data, originUrl);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (err) {
      console.error(`Gagal melakukan sinkronisasi untuk dealer ${code}:`, err.message);
      failCount++;
    }
  }

  console.log('\n--- Hasil Sinkronisasi ---');
  console.log(`Berhasil disinkronkan: ${successCount}`);
  console.log(`Gagal/Dilewati       : ${failCount}`);
  console.log('--------------------------');
  console.log('Selesai.');
}

syncAll();
