const fs = require('fs');
const path = require('path');

// List of 220 dealer codes provided by the user
const DEALER_CODES = [
  "FAUA", "JADB", "TBN", "JIMF", "OTM", "KCCD", "SAJU", "EGMT", "GEE", "HAGA",
  "KCBW", "JIMG", "FFQA", "NAVB", "HIJKB", "LLA", "BJTABB", "YAIZ", "SAJV", "LCHC",
  "PDAC", "TEJ", "EAQ", "RAUA", "KCBX", "THFW", "THFX", "EGKHSH", "TAQBB", "HBR",
  "YAEF", "SHJ", "PDAQ", "DABC", "TDI", "YAIE", "JADC", "EDIA", "RJHB", "HHY",
  "DAAE", "TEEOT", "DAAK", "TEN", "TDGB", "PBA", "LEM", "OBR", "TEEOW", "TEEOG",
  "GCGB", "SBM", "TAVA", "NDX", "HLBB", "JIHRB", "LECH", "JJF", "DABM", "TFKB",
  "EHRB", "EGKA", "WKQD", "THCAA", "YKA", "TEEOU", "RDS", "TABK", "GFH", "TDSE",
  "YACP", "KDY", "EGOC", "KCCI", "IAAE", "FAUPA", "YAIO", "HIJGB", "GAGB", "AYU",
  "EKM", "TFL", "JIHJB", "EGJC", "LCHAB", "YAEH", "TEEOF", "EGKO", "KDNA", "EGJB",
  "TJJ", "WKTA", "BJTB", "FDNB", "JIHWB", "GOPB", "KCEZ", "HHX", "EGIZ", "TACFB",
  "GOWB", "OQEBB", "ORGA", "YAJC", "HDAO", "KCEY", "YAEG", "THCQ", "JIMH", "YAJI",
  "HKTA", "OQEAB", "OQECB", "JIHMB", "JCMB", "GFWA", "HEAL", "TACM", "THGE", "SAADA",
  "SCYA", "RCDB", "HLCA", "HLD", "TEFJ", "TDSZA", "LECF", "TEEHB", "KCDT", "TACR",
  "AYUA", "TEEJA", "TEEO", "GEAU", "TBND", "HBIJ", "YAHN", "TEFB", "THFZ", "GEAA",
  "YAEI", "TEDU", "RDT", "NDNA", "TACZA", "NDLA", "HBIT", "DAAC", "HFXDA", "YAAPA",
  "LIEB", "BJTAEB", "YAEB", "THGG", "HBIQ", "OSB", "JJE", "EGJM", "THED", "JCRB",
  "KCEL", "YAAR", "EBAE", "OSY", "RCK", "YAHO", "HLDB", "LIG", "GOXB", "GABW",
  "THCL", "YAIP", "EBAL", "JJA", "FEK", "SAJW", "TEEPV", "BJTC", "KCCB", "LIN",
  "THCLA", "YAIQ", "EGPH", "YAIW", "YADT", "RCQ", "SAJR", "FEG", "TEEOS", "GEAV",
  "YADX", "YAIJ", "KGCA", "EGJA", "THCZ", "HDAI", "THCY", "WKTE", "EBAQ", "PBB",
  "TEDE", "RDU", "EGKC", "SAJZ", "TEDG", "LEBP", "IAAC", "LEBY", "TEDK", "RDB",
  "SHG", "OTP", "PGH", "VAAC", "MAAD", "FEAY", "DABA", "JJV", "DABD", "DABJ"
];

const DEALER_NAMES = [
  "LIMA MOTOR, PD - Subang", "SUMBER REJEKI, CV - Sumedang Utara", "MURNI MOTOR I, PT", "BERDIKARI MOTOR JAYA, PT",
  "SINARMAS MOTOR, CV", "SINAR ABADI, PD", "SELAMAT LESTARI MANDIRI, PT - Gunung Puyuh", "ARTA CITRA HARMONI, PT",
  "FORTUNA MOTOR, CV", "MERDEKA MOTOR, PT - Bekasi", "SETIA KAWAN MOTOR I, PD", "BERDIKARI MOTOR JAYA II, PT",
  "MARCONI MANDIRIPERKASA, PT", "LIMA MOTOR, PD - Garut", "DAYA ANUGRAH MANDIRI, PT - KaliMalang", "PRIMA KUNING KENCANA, PT - Kuningan",
  "DAYA ANUGRAH MANDIRI, PT - Kiara Condong", "MERDEKA MOTOR, PT - Cikarang", "SELAMAT LESTARI MANDIRI, PT - Pel.Ratu", "MULIA MOTOR II, PD",
  "NETRAL JAYA MOTOR, PT - Pangandaran", "MURNI PUTRAMAS, PT", "PERWIRATAMA DARMAGUNA, PT", "DUTA NIAGA MULTI SEJAHTERA, PT",
  "SETIA KAWAN MOTOR II, PD", "MURNI MOTOR II, PT", "MURNI MOTOR III, PT", "DAYA ADICIPTA MOTORA, PT",
  "DAYA ANUGRAH MANDIRI, PT - Cisalak", "GRAHA PRAWIRA DANISWARA, PT", "PACIFIC MOTOR I, PT", "TERUS JAYA SENTOSA MOTOR, PT - Sukabumi",
  "SETIA KAWAN MOTOR III, PD", "WIJAYA ABADI, PD", "KUSUMASEJATI INTIPRIMA, PT - Bogor", "VIRGI MOTOR, PD - BEKASI",
  "SUMBER REJEKI, CV - Tanjung Sari", "SINAR REJEKI MOTOR, PT", "AMARTA SAYAP MERAH, PT - Bandung", "RIFANA MULYA ABADI, CV",
  "SINAR KARYA MAKMUR, CV", "STAR MOTOR I, PD", "AMARTA SAYAP MERAH, PT", "PRABUPENDAWA MANUNGGAL, PT",
  "TRI KARYATAMA JAYA, PT", "SETIA KAWAN MOTOR I, PD", "KARYA PERDANA, CV", "SUBUR JAYA, CV",
  "STAR MOTOR II, PD", "PRAKASA II, PD", "NUSANTARA SURYA SAKTI, PT - Karawang", "MEGA MOTOR, CV - Sukabumi",
  "GUNA MOTOR, CV", "SURYA WIJAYA SEJAHTERA, CV", "DAYA ANUGRAH MANDIRI, PT - Tambun", "DAYA ANUGRAH MANDIRI, PT - Tuparev",
  "DEASSY SUKSES MANDIRI, PT", "CEMARA AGUNG PERDANA, PT - Sumedang", "Berkat Abadi Motor, CV", "LESTARI MOTOR, CV",
  "HARI BARU GEMILANG, PT", "CEMARA AGUNG SEJAHTERA, PT - Bandung", "ARTAMAS KURNIA, PT", "BINTANG NIAGA JAYA, PT",
  "MITRA JAYA, CV - Bekasi", "STAR MOTOR III, PD", "AGUNG MOTOR, CV", "MEGA MOTOR, CV - Bogor",
  "LIMA MOTOR, PD - Purwakarta", "PELANGI PRIMA MANDIRI, CV", "BINTANG ALAM JAYA, PT - Bekasi", "PERMATA DHARMA FORTUNA, CV",
  "WIJAYA ADIPURA SENTOSA, PT", "PRIMA DJAJA SADAYA, PT - Cirebon", "DWI SETIA KAWAN, PD", "LIMA MOTOR, PD - Purwodadi",
  "MITRA JAYA, CV - Depok", "DAYA ANUGRAH MANDIRI, PT - Pondok Gede", "LIMA MOTOR, PD - Karawang", "NAGAMAS MITRA ABADI, CV - Batununggal",
  "DAYA ALVITA MANDIRI, PT", "ANUGERAH SEJAHTERA, CV", "DAYA ANUGRAH MANDIRI, PT - Arjawinangun", "GELORA FAJAR PERKASA, PT",
  "MULIA MOTOR I, PD", "PACIFIC MOTOR III, PT", "PRAKASA I, PD", "REJEKI PUTERA MANDIRI, CV",
  "SEJAHTERA MULIA MOTOR, PD", "WAHANAARTHA RITELINDO, PT", "PUTERA MERDEKA, CV", "ASTRA INTERNATIONAL- HSO, PT",
  "DAYA ANUGRAH MANDIRI, PT - Asia Afrika", "DAYA ANUGRAH MANDIRI, PT - Subang", "DAYA ANUGRAH MANDIRI, PT - Indramayu", "DUTA VICTORY RAYA, CV",
  "PACIFIC AREA JAYA , PT - Cirebon", "CATUR PUTRA JAYA, PT - Bekasi", "NETRAL JAYA MOTOR, PT - Pasirkaliki", "DAYA ANUGRAH MANDIRI, PT - Bogor",
  "DAYA ANUGRAH MANDIRI, PT - Cikampek", "DAYA ANUGRAH MANDIRI, PT - Tasik", "AGUNG JAYA BERSAMA, PT", "AMARTA SAYAP MERAH, PT - Bekasi",
  "BINTANG MOTOR JAYA, PT - Cikarang", "MITRA UTAMA MOTORA, PT - Cirebon", "PACIFIC MOTOR II, PT", "SUPRA JAYA MOTOR, CV - Gn. Putri",
  "BERDIKARI MOTOR JAYA III, PT", "PACIFIC AREA JAYA , PT - Bekasi", "CAKRA LAKSANA SAKTI, PT", "DAYA ANUGRAH MANDIRI, PT - Garut",
  "DAYA ANUGRAH MANDIRI, PT - Ciamis", "DAYA ANUGRAH MANDIRI, PT - Majalengka", "DAYA ANUGRAH MANDIRI, PT - Jatinangor", "DAYA ANUGRAH MANDIRI, PT - Purwakarta",
  "DAYA ANUGRAH MANDIRI, PT - Cikarang", "SETIA ANUGERAH MOTOR, PT", "KUSUMASEJATI INTIPRIMA, PT - Bekasi", "DAYA ANUGRAH MANDIRI, PT - Sukabumi",
  "NUSANTARA SURYA SAKTI, PT - Sukabumi", "DAYA ANUGRAH MANDIRI, PT - Cianjur", "BINTANG KEMAKMURAN, PT", "TUNAS DWIPA MATRA, PT - Bekasi",
  "BINTANG MOTOR JAYA, PT - Depok", "RINA MITRA RAHARJA, PT", "TRIDJAYA ANUGERAH SUKSES, CV - Indramayu", "DAYA ANUGRAH MANDIRI, PT - Sawangan",
  "BINTANG ANUGRAH MOTOR, PT", "SOLUSI TULUS MITRA, PT", "NAGAMAS MITRA SENTOSA, CV", "DAYA ANUGRAH MANDIRI, PT - Kelapa Dua",
  "METAGUNA INNOVA, PT - Depok", "CEMARA AGUNG PRATAMA, PD - Karawang", "MURNI MOTOR IV, PT", "MURNI SUBAJA MAS, PT",
  "SUPRAJAYA MOTOR, CV - JatiAsih", "BERKAH PRIMA SEJATI, PT - Depok", "KIRANA MOTORINDO JAYA, CV", "RAMA, CV",
  "PACIFIC MOTOR IV, PT", "CATUR PUTRA JAYA, PT - Depok", "AGUNG MOTOR, CV - PACET", "ANUGRAH HASTA MULIA, PT",
  "SANPRIMA SENTOSA, PT", "CEMARA GUNA LESTARI, CV", "CIBITUNG MOTOR MANDIRI, PT - Bekasi", "SETIA ABADI MITRA MOTOR, PT",
  "RODA MITRA LESTARI, CV", "KUJANG SAKTI ANUGRAH, PT", "DAYA ANUGRAH MANDIRI, PT - Kuningan", "DAYA ANUGRAH MANDIRI, PT - Soreang",
  "BERKAH PRATAMA SINERGI, PT", "DESCONINDOTAMA, PT", "MILLENIUM PUTRA MOTOR, CV", "NETRAL JAYA MOTOR, PT - Tasik",
  "SINAR MAKMUR, CV", "EKA SURYA WIJAYA, PT", "CATUR PUTRA JAYA, PT - Bogor", "DAYA ANUGRAH MANDIRI, PT - Sumedang",
  "BINTANG MOTOR JAYA, PT - Cirebon", "SINAR MULIA SEJAHTERA, PT", "DWI PUTRA ANUGRAH PERKASA, PT", "NIAGA REDJA ABADI, PT",
  "RODA MAS AUTO LESTARI, CV", "SUPRA JAYA MOTOR, CV - Cibitung", "TUNAS DWIPA MATRA, PT - Bandung", "AS PUTRA RAHMAT, CV",
  "DAYA ANUGRAH MANDIRI, PT - Karawang", "PLATINUM MANDIRI SEJAHTERA, PT", "HARIKA PRIMA SAKTI, PT - Bogor", "MITRA JAYA, CV - Bandung",
  "NAGAMAS MITRA ABADI, CV - Cimahi", "NAFRIYA ABADI MOTOR, PT", "TRIDJAYA SEJAHTERA SUKSES, CV - SUBANG", "SELAMAT LESTARI MANDIRI, PT - PAMURUYAN",
  "VIRGI MOTOR, PT - KARAWANG", "DAYA ANUGRAH MANDIRI, PT - Soekarno Hatta", "AMARTA SAYAP MERAH, PT - Cirebon", "AMARTA SAYAP MERAH, PT - Kuningan",
  "HARIKA PRIMA SAKTI, PT - Karawang", "BINTANG ALAM JAYA, PT - Bandung", "MITRADEKA MANDIRI, PT - RANCAEKEK", "CIBITUNG MOTOR MANDIRI, PT - Purwakarta",
  "CATUR ANUGERAH MANDIRI, PT", "DAYA ANUGRAH MANDIRI, PT - Cibeber", "DAYA ANUGRAH MANDIRI, PT - Cicantayan", "PACIFIC MOTOR, PT - Subang",
  "MARCONI MANDIRIPERKASA, PT - Karawang", "CEMARA AGUNG PRATAMA, PD - Purwakarta", "BEKASI MOTOR, PT", "METAGUNA INNOVA, PT - Bekasi",
  "MITRA UTAMA, PD - Kuningan", "WIJAYA ABADI MULIA, PT", "MITRA SEHATI JAYA, CV", "HARIKA PRIMA SAKTI, PT - Bekasi",
  "DHARMA MAKMUR BERSAMA, PT", "MITRA PINASTHIKA MUSTIKA, PT", "DAYA ANUGRAH MANDIRI, PT - Cimahi", "ASTRA INTERNATIONAL- HSO, PT - Banjar",
  "DAYA ANUGRAH MANDIRI, PT - Depok", "SUPRA JAYA MOTOR, CV - Cianjur", "SEJAHTERA INTI ANUGRAH PERKASA, PT", "TUNAS DWIPA MATRA, PT - Sukabumi",
  "TUNAS DWIPA MATRA, PT - Depok", "DAYA ANUGRAH MANDIRI, PT - Indramayu (2)", "NAFRIYA ABADI MOTOR, PT - Indramayu", "MAWAR MOTOR FAYURI, PT",
  "BARENO TIGA BERSAUDARA, PT", "NUSANTARA SURYA SAKTI, PT - Cianjur", "ASTRA INTERNATIONAL, PT - Sukabumi", "NATA DAYA MANDIRI, CV",
  "BUDIMAN MOTOR", "DAYA ANUGRAH MANDIRI, PT - Radar Auri", "HELMI MOTOR", "PANDAWA MOTOR, PD - Subang",
  "DAYA ANUGRAH MANDIRI, PT - Cibiru", "WAHANAARTHA RITELINDO, PT - Sumedang", "TRIDJAYA MERDEKA SUKSES, PT - Bandung", "BERUANG MOTOR TERPADU, CV"
];

// Generate dealer list mapping
const DEALERS = {};
DEALER_CODES.forEach((code, idx) => {
  DEALERS[code] = {
    code: code,
    name: `${DEALER_NAMES[idx]} (${code})`
  };
});

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'submissions.json');

// Ensure data folder and file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2), 'utf8');
}

// Read database
function readDB() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database file:', error);
    return {};
  }
}

// Write database
function writeDB(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing database file:', error);
    return false;
  }
}

module.exports = {
  DEALER_CODES,
  DEALERS,
  
  // Get all submissions
  getAllSubmissions() {
    return readDB();
  },
  
  // Get submission by dealer code
  getSubmission(code) {
    const db = readDB();
    return db[code] || null;
  },
  
  // Save or update submission
  saveSubmission(code, data) {
    const db = readDB();
    db[code] = {
      ...db[code],
      ...data,
      code: code,
      timestamp: new Date().toISOString()
    };
    return writeDB(db);
  },
  
  // Validate dealer code
  isValidDealer(code) {
    return DEALER_CODES.includes(code.toUpperCase());
  },
  
  // Get dealer details by code
  getDealerDetails(code) {
    return DEALERS[code.toUpperCase()] || null;
  }
};
