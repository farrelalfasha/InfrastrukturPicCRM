// Global State
let currentUser = null;
let dealersList = {};
let dealerCodes = [];
let submissionsList = {};
let currentStep = 1;
let selectedFile = null;

// API URL helpers
const API_BASE = '/api';

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupEventListeners();
});

// Setup Initial State & Check Sessions
async function initApp() {
  await fetchDealers();
  
  const savedUser = localStorage.getItem('honda_crm_user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      showUserProfile();
      
      if (currentUser.role === 'admin') {
        showView('adminDashboardView');
        loadAdminDashboard();
      } else {
        showView('dealerFormView');
        loadDealerPortal();
      }
    } catch (e) {
      localStorage.removeItem('honda_crm_user');
      showView('loginView');
    }
  } else {
    showView('loginView');
  }
}

// Fetch Dealer lists for dropdown population
async function fetchDealers() {
  try {
    const res = await fetch(`${API_BASE}/dealers`);
    const data = await res.json();
    dealersList = data.dealers;
    dealerCodes = data.codes;
    
    // Populate step 1 dropdowns
    const kodeSelect = document.getElementById('kodeDealer');
    const namaSelect = document.getElementById('namaDealer');
    
    kodeSelect.innerHTML = '<option value="" disabled selected>Pilih Kode Dealer</option>';
    namaSelect.innerHTML = '<option value="" disabled selected>Pilih Nama Dealer</option>';
    
    Object.keys(dealersList).forEach(code => {
      const optionKode = document.createElement('option');
      optionKode.value = code;
      optionKode.textContent = code;
      kodeSelect.appendChild(optionKode);

      const optionNama = document.createElement('option');
      optionNama.value = dealersList[code].name;
      optionNama.textContent = dealersList[code].name;
      namaSelect.appendChild(optionNama);
    });
  } catch (error) {
    showToast('Gagal memuat daftar dealer.', 'error');
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Login Form
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  
  // Logout Button
  document.getElementById('btnLogoutBtn').addEventListener('click', handleLogout);
  
  // Wizard Navigation
  document.getElementById('btnNext').addEventListener('click', nextStep);
  document.getElementById('btnPrev').addEventListener('click', prevStep);
  document.getElementById('dealerWizardForm').addEventListener('submit', handleFormSubmit);

  // Auto age calculations
  document.getElementById('tanggalLahirPic').addEventListener('change', calculatePicAge);

  // File Upload Drag & Drop
  const dropzone = document.getElementById('photoDropzone');
  const fileInput = document.getElementById('fotoPicCrm');
  const removePhotoBtn = document.getElementById('btnRemovePhoto');

  fileInput.addEventListener('change', (e) => {
    handlePhotoSelect(e.target.files[0]);
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      handlePhotoSelect(e.dataTransfer.files[0]);
    }
  });

  removePhotoBtn.addEventListener('click', removeSelectedPhoto);

  // Admin H1 & H2 conditional inputs display
  document.getElementById('punyaAdminH2').addEventListener('change', (e) => {
    toggleContainer('adminH2Container', e.target.value === 'Ya');
  });

  document.getElementById('punyaAdminH1').addEventListener('change', (e) => {
    toggleContainer('adminH1Container', e.target.value === 'Ya');
  });

  // Broadcast systems conditional inputs display
  document.getElementById('punyaWaBlast').addEventListener('change', (e) => {
    toggleContainer('waBlastContainer', e.target.value === 'Ya');
  });

  document.getElementById('punyaSmsBroadcast').addEventListener('change', (e) => {
    toggleContainer('smsBroadcastContainer', e.target.value === 'Ya');
  });

  // Admin search & filter events
  document.getElementById('adminSearchInput').addEventListener('input', filterDealersGrid);
  document.getElementById('adminFilterStatus').addEventListener('change', filterDealersGrid);
  document.getElementById('btnExportExcel').addEventListener('click', exportToExcel);

  // Modal close
  document.getElementById('btnModalClose').addEventListener('click', closeModal);
  window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('detailModal')) {
      closeModal();
    }
  });
}

// Show specific layout screen
function showView(viewId) {
  const views = ['loginView', 'dealerFormView', 'adminDashboardView'];
  views.forEach(v => {
    const el = document.getElementById(v);
    if (v === viewId) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });

  const profile = document.getElementById('userProfile');
  if (viewId === 'loginView') {
    profile.classList.add('hidden');
    document.body.classList.remove('logged-in');
  } else {
    profile.classList.remove('hidden');
    document.body.classList.add('logged-in');
  }
}

// Display User Profil in Header
function showUserProfile() {
  document.getElementById('profileName').textContent = currentUser.name;
  document.getElementById('profileRole').textContent = currentUser.role === 'admin' ? 'Main Dealer Admin' : `Dealer (${currentUser.code})`;
}

// Login API handler
async function handleLogin(e) {
  e.preventDefault();
  const loginCodeInput = document.getElementById('loginCode');
  const loginPasswordInput = document.getElementById('loginPassword');
  const code = loginCodeInput.value.trim();
  const password = loginPasswordInput.value.trim();
  const errorEl = document.getElementById('loginError');

  errorEl.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, password })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Login gagal.');
    }

    const data = await res.json();
    currentUser = {
      token: data.token,
      role: data.role,
      name: data.name,
      code: data.code
    };

    localStorage.setItem('honda_crm_user', JSON.stringify(currentUser));
    showUserProfile();
    showToast(`Selamat datang, ${data.name}!`, 'success');

    if (currentUser.role === 'admin') {
      showView('adminDashboardView');
      loadAdminDashboard();
    } else {
      showView('dealerFormView');
      loadDealerPortal();
    }
    
    loginCodeInput.value = '';
    loginPasswordInput.value = '';
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.style.display = 'block';
  }
}

// Logout handler
function handleLogout() {
  localStorage.removeItem('honda_crm_user');
  currentUser = null;
  selectedFile = null;
  currentStep = 1;
  showView('loginView');
  showToast('Berhasil keluar dari sesi.', 'success');
}

// Calculate PIC age automatically from dob
function calculatePicAge() {
  const dobInput = document.getElementById('tanggalLahirPic').value;
  if (!dobInput) return;

  const dob = new Date(dobInput);
  const diffMs = Date.now() - dob.getTime();
  const ageDate = new Date(diffMs);
  const age = Math.abs(ageDate.getUTCFullYear() - 1970);

  if (!isNaN(age)) {
    document.getElementById('usiaPic').value = age;
  }
}

// Toggle field containers (Admin CRM H1 & H2)
function toggleContainer(containerId, show) {
  const el = document.getElementById(containerId);
  const inputs = el.querySelectorAll('input, select');
  
  if (show) {
    el.classList.remove('hidden');
    inputs.forEach(input => {
      if (input.id !== 'emailAdminH2' && input.id !== 'emailAdminH1') {
        input.required = true;
      }
    });
  } else {
    el.classList.add('hidden');
    inputs.forEach(input => {
      input.required = false;
      input.value = '';
    });
  }
}

// Handle Photo selection/drag
function handlePhotoSelect(file) {
  if (!file) return;

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    showToast('Tipe file tidak didukung! Gunakan format JPG, PNG, atau WEBP.', 'error');
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showToast('Ukuran file maksimal 5MB.', 'error');
    return;
  }

  selectedFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('previewImg').src = e.target.result;
    document.getElementById('photoName').textContent = file.name;
    document.getElementById('photoSize').textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';
    
    document.getElementById('photoPreviewBox').classList.remove('hidden');
    document.getElementById('photoDropzone').classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

// Remove Selected Photo from Preview
function removeSelectedPhoto() {
  selectedFile = null;
  document.getElementById('fotoPicCrm').value = '';
  document.getElementById('photoPreviewBox').classList.add('hidden');
  document.getElementById('photoDropzone').classList.remove('hidden');
}

// Load Dealer submission portal
async function loadDealerPortal() {
  currentStep = 1;
  updateWizardUI();
  selectedFile = null;
  removeSelectedPhoto();

  // Reset toggleable containers
  toggleContainer('adminH2Container', false);
  toggleContainer('adminH1Container', false);
  toggleContainer('waBlastContainer', false);
  toggleContainer('smsBroadcastContainer', false);

  // Pre-select the login dealer code and dealer name
  const kodeSelect = document.getElementById('kodeDealer');
  const namaSelect = document.getElementById('namaDealer');
  
  kodeSelect.value = currentUser.code;
  namaSelect.value = dealersList[currentUser.code]?.name || '';

  // Get status
  try {
    const res = await fetch(`${API_BASE}/dealer/status`, {
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    });
    const data = await res.json();

    if (data.submitted && data.data) {
      prefillFormData(data.data);
      showToast('Memuat data pengisian Anda sebelumnya.', 'success');
    }
  } catch (err) {
    showToast('Gagal memuat status pengisian dealer.', 'error');
  }
}

// Prefill form fields with previously submitted details
function prefillFormData(data) {
  // Set basic dropdowns
  document.getElementById('kodeDealer').value = data.kodeDealer || currentUser.code;
  document.getElementById('namaDealer').value = data.namaDealer || (dealersList[currentUser.code]?.name || '');

  // Section 1
  document.getElementById('namaKacab').value = data.namaKacab || '';
  document.getElementById('hondaIdKacab').value = data.hondaIdKacab || '';
  document.getElementById('noHpKacab').value = data.noHpKacab || '';
  document.getElementById('emailKacab').value = data.emailKacab || '';
  
  document.getElementById('namaKabeng').value = data.namaKabeng || '';
  document.getElementById('hondaIdKabeng').value = data.hondaIdKabeng || '';
  document.getElementById('noHpKabeng').value = data.noHpKabeng || '';
  document.getElementById('emailKabeng').value = data.emailKabeng || '';

  // Section 2
  document.getElementById('namaPicCrm').value = data.namaPicCrm || '';
  document.getElementById('hondaIdPic').value = data.hondaIdPic || '';
  document.getElementById('noHpPic').value = data.noHpPic || '';
  document.getElementById('emailPic').value = data.emailPic || '';
  document.getElementById('statusPic').value = data.statusPic || '';
  document.getElementById('tanggalLahirPic').value = data.tanggalLahirPic || '';
  document.getElementById('usiaPic').value = data.usiaPic || '';
  document.getElementById('lamaKerjaPic').value = data.lamaKerjaPic || '';
  document.getElementById('pendidikanPic').value = data.pendidikanPic || '';

  if (data.fotoPicCrm) {
    document.getElementById('previewImg').src = data.fotoPicCrm;
    document.getElementById('photoName').textContent = 'Foto Terunggah';
    document.getElementById('photoSize').textContent = 'Disimpan di server';
    document.getElementById('photoPreviewBox').classList.remove('hidden');
    document.getElementById('photoDropzone').classList.add('hidden');
  }

  // Section 3: Admin CRM H2
  const punyaH2 = data.punyaAdminH2 || 'Tidak';
  document.getElementById('punyaAdminH2').value = punyaH2;
  toggleContainer('adminH2Container', punyaH2 === 'Ya');
  if (punyaH2 === 'Ya') {
    document.getElementById('namaAdminH2').value = data.namaAdminH2 || '';
    document.getElementById('noHpAdminH2').value = data.noHpAdminH2 || '';
    document.getElementById('emailAdminH2').value = data.emailAdminH2 || '';
    document.getElementById('statusAdminH2').value = data.statusAdminH2 || '';
    document.getElementById('usiaAdminH2').value = data.usiaAdminH2 || '';
    document.getElementById('lamaKerjaAdminH2').value = data.lamaKerjaAdminH2 || '';
    document.getElementById('pendidikanAdminH2').value = data.pendidikanAdminH2 || '';
  }

  // Section 3: Admin CRM H1
  const punyaH1 = data.punyaAdminH1 || 'Tidak';
  document.getElementById('punyaAdminH1').value = punyaH1;
  toggleContainer('adminH1Container', punyaH1 === 'Ya');
  if (punyaH1 === 'Ya') {
    document.getElementById('namaAdminH1').value = data.namaAdminH1 || '';
    document.getElementById('noHpAdminH1').value = data.noHpAdminH1 || '';
    document.getElementById('emailAdminH1').value = data.emailAdminH1 || '';
    document.getElementById('statusAdminH1').value = data.statusAdminH1 || '';
    document.getElementById('usiaAdminH1').value = data.usiaAdminH1 || '';
    document.getElementById('lamaKerjaAdminH1').value = data.lamaKerjaAdminH1 || '';
    document.getElementById('pendidikanAdminH1').value = data.pendidikanAdminH1 || '';
  }

  // Section 4
  const punyaWa = data.punyaWaBlast || '';
  document.getElementById('punyaWaBlast').value = punyaWa;
  toggleContainer('waBlastContainer', punyaWa === 'Ya');
  if (punyaWa === 'Ya') {
    document.getElementById('appsWaBlast').value = data.appsWaBlast || '';
    document.getElementById('noWaBroadcast').value = data.noWaBroadcast || '';
    document.getElementById('statusNoWaBroadcast').value = data.statusNoWaBroadcast || '';
    document.getElementById('isWaBusiness').value = data.isWaBusiness || '';
    document.getElementById('caraBroadcastWa').value = data.caraBroadcastWa || '';
  }

  const punyaSms = data.punyaSmsBroadcast || '';
  document.getElementById('punyaSmsBroadcast').value = punyaSms;
  toggleContainer('smsBroadcastContainer', punyaSms === 'Ya');
  if (punyaSms === 'Ya') {
    document.getElementById('appsSmsBroadcast').value = data.appsSmsBroadcast || '';
    document.getElementById('caraBroadcastSms').value = data.caraBroadcastSms || '';
  }

  // Checklist
  document.getElementById('consentCheckbox').checked = data.consentAccepted || false;
}

// Wizard Steps logic
function updateWizardUI() {
  // Update step progress line width
  const progressPercent = ((currentStep - 1) / 3) * 100;
  document.getElementById('stepProgressLine').style.width = `${progressPercent}%`;

  // Update step bubble highlights
  document.querySelectorAll('.wizard-step').forEach(step => {
    const sNum = parseInt(step.getAttribute('data-step'));
    step.classList.remove('active', 'completed');
    if (sNum === currentStep) {
      step.classList.add('active');
    } else if (sNum < currentStep) {
      step.classList.add('completed');
    }
  });

  // Display active step form container
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`step${i}Content`);
    if (i === currentStep) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  // Configure navigation buttons
  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  const btnSubmit = document.getElementById('btnSubmitForm');

  if (currentStep === 1) {
    btnPrev.classList.add('hidden');
    btnNext.classList.remove('hidden');
    btnSubmit.classList.add('hidden');
  } else if (currentStep === 4) {
    btnPrev.classList.remove('hidden');
    btnNext.classList.add('hidden');
    btnSubmit.classList.remove('hidden');
  } else {
    btnPrev.classList.remove('hidden');
    btnNext.classList.remove('hidden');
    btnSubmit.classList.add('hidden');
  }
}

// Proceed to next step in Wizard
function nextStep() {
  if (validateCurrentStep()) {
    currentStep++;
    updateWizardUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// Fallback to previous step in Wizard
function prevStep() {
  currentStep--;
  updateWizardUI();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Validate inputs of the current section
function validateCurrentStep() {
  const currentContainer = document.getElementById(`step${currentStep}Content`);
  const requiredInputs = currentContainer.querySelectorAll('[required]');
  let isValid = true;

  requiredInputs.forEach(input => {
    if (!input.value.trim() && !input.disabled) {
      isValid = false;
      input.style.borderColor = '#dc3545';
      // Reset color on input
      input.addEventListener('input', () => {
        input.style.borderColor = '';
      }, { once: true });
    }
  });

  // Section 2 Special Validation: Check if Photo PIC CRM is uploaded
  if (currentStep === 2) {
    const photoUploader = document.getElementById('photoDropzone');
    const photoUploaded = selectedFile !== null || document.getElementById('photoPreviewBox').classList.contains('hidden') === false;
    
    if (!photoUploaded) {
      isValid = false;
      photoUploader.style.borderColor = '#dc3545';
      showToast('Harap unggah foto PIC CRM Anda terlebih dahulu.', 'error');
      
      fileInput = document.getElementById('fotoPicCrm');
      fileInput.addEventListener('change', () => {
        photoUploader.style.borderColor = '';
      }, { once: true });
    }
  }

  if (!isValid) {
    showToast('Harap lengkapi semua kolom wajib di halaman ini.', 'error');
  }

  return isValid;
}

// Form Submission logic
async function handleFormSubmit(e) {
  e.preventDefault();

  if (!validateCurrentStep()) return;

  const consentCheckbox = document.getElementById('consentCheckbox');
  if (!consentCheckbox.checked) {
    showToast('Anda harus menyetujui syarat penggunaan data pribadi untuk mengirim form ini.', 'error');
    return;
  }

  const form = document.getElementById('dealerWizardForm');
  const formData = new FormData(form);

  // Since drop-downs are disabled in the DOM, they won't automatically send.
  // We explicitly append them to form data.
  formData.set('kodeDealer', currentUser.code);
  formData.set('namaDealer', dealersList[currentUser.code]?.name || '');

  // Append photo file explicitly if selected
  if (selectedFile) {
    formData.set('fotoPicCrm', selectedFile);
  }

  // Send request to server
  try {
    showToast('Mengirim data...', 'info');
    
    const res = await fetch(`${API_BASE}/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${currentUser.token}`
      },
      body: formData
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Gagal menyimpan form.');
    }

    showToast('Data form PIC CRM berhasil disimpan!', 'success');
    loadDealerPortal();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Load Admin Dashboard
async function loadAdminDashboard() {
  const grid = document.getElementById('dealersGrid');
  grid.innerHTML = `
    <div class="empty-state">
      <i class="fa-solid fa-spinner fa-spin empty-icon" style="font-size: 2.5rem; color: var(--primary);"></i>
      <h4 class="empty-title">Memuat Data Submisi...</h4>
    </div>
  `;

  try {
    const res = await fetch(`${API_BASE}/submissions`, {
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    });
    
    if (!res.ok) throw new Error('Gagal mengakses data dashboard.');

    const data = await res.json();
    submissionsList = data.submissions;

    // Handle Google Sheets button visibility and link
    const btnOpenSheets = document.getElementById('btnOpenSpreadsheet');
    if (btnOpenSheets) {
      if (data.spreadsheetUrl) {
        btnOpenSheets.href = data.spreadsheetUrl;
        btnOpenSheets.classList.remove('hidden');
      } else {
        btnOpenSheets.classList.add('hidden');
      }
    }

    renderStats();
    renderDealersGrid();
  } catch (error) {
    showToast(error.message, 'error');
    grid.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-circle-exclamation empty-icon" style="color: var(--primary);"></i>
        <h4 class="empty-title">Terjadi Kesalahan</h4>
        <p class="empty-desc">${error.message}</p>
      </div>
    `;
  }
}

// Compute statistics counts
function renderStats() {
  const totalDealers = dealerCodes.length;
  const filledCount = Object.keys(submissionsList).length;
  const pendingCount = totalDealers - filledCount;
  const percentFilled = totalDealers > 0 ? Math.round((filledCount / totalDealers) * 100) : 0;

  document.getElementById('statTotalDealers').textContent = totalDealers;
  document.getElementById('statTotalFilled').textContent = filledCount;
  document.getElementById('statTotalPending').textContent = pendingCount;
  document.getElementById('statPercentFilled').textContent = `${percentFilled}%`;
}

// Render cards grid
function renderDealersGrid() {
  const grid = document.getElementById('dealersGrid');
  grid.innerHTML = '';

  const searchQuery = document.getElementById('adminSearchInput').value.toLowerCase().trim();
  const filterStatus = document.getElementById('adminFilterStatus').value;

  let renderedCount = 0;

  // Render cards for all 220 dealer codes
  dealerCodes.forEach(code => {
    const dealerInfo = dealersList[code] || { name: `Dealer ${code}`, code: code };
    const submission = submissionsList[code];
    const isFilled = !!submission;

    // Filter logic
    if (filterStatus === 'filled' && !isFilled) return;
    if (filterStatus === 'unfilled' && isFilled) return;

    if (searchQuery) {
      const matchCode = code.toLowerCase().includes(searchQuery);
      const matchName = dealerInfo.name.toLowerCase().includes(searchQuery);
      const matchPic = isFilled && submission.namaPicCrm ? submission.namaPicCrm.toLowerCase().includes(searchQuery) : false;
      
      if (!matchCode && !matchName && !matchPic) return;
    }

    renderedCount++;

    const card = document.createElement('div');
    card.className = 'dealer-card glass-panel';
    card.addEventListener('click', () => showDealerDetail(code));

    const photoUrl = (isFilled && submission.fotoPicCrm) ? submission.fotoPicCrm : 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
    const picName = isFilled ? submission.namaPicCrm : 'Belum diisi';
    const tenure = isFilled ? submission.lamaKerjaPic : '-';

    card.innerHTML = `
      <div class="dealer-card-photo-wrapper">
        <img src="${photoUrl}" alt="${picName}" class="dealer-card-photo">
        <span class="dealer-card-code-badge">${code}</span>
      </div>
      <h4 class="dealer-card-name">${dealerInfo.name}</h4>
      <div class="dealer-card-pic"><i class="fa-solid fa-user-tie" style="margin-right: 5px; font-size: 0.85rem;"></i> ${picName}</div>
      <div class="dealer-card-tenure"><i class="fa-solid fa-briefcase"></i> Usia Kerja: ${tenure}</div>
      <div class="dealer-card-status ${isFilled ? '' : 'unfilled'}">
        ${isFilled ? '<i class="fa-solid fa-circle-check"></i> Sudah Mengisi' : '<i class="fa-solid fa-circle-minus"></i> Belum Mengisi'}
      </div>
    `;

    grid.appendChild(card);
  });

  if (renderedCount === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-box-open empty-icon"></i>
        <h4 class="empty-title">Tidak Ada Hasil Cocok</h4>
        <p class="empty-desc">Coba ubah kata kunci pencarian atau filter status Anda.</p>
      </div>
    `;
  }
}

// Live filtering grid
function filterDealersGrid() {
  renderDealersGrid();
}

// Open modal and show full dealer details
function showDealerDetail(code) {
  const dealerInfo = dealersList[code] || { name: `Dealer ${code}`, code: code };
  const submission = submissionsList[code];
  
  const modal = document.getElementById('detailModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');

  modalTitle.innerHTML = `<i class="fa-solid fa-store" style="color: var(--primary); margin-right: 10px;"></i> ${dealerInfo.name}`;

  if (!submission) {
    modalBody.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <i class="fa-solid fa-circle-exclamation" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1.5rem;"></i>
        <h3 style="margin-bottom: 0.5rem;">Dealer Belum Mengisi Form</h3>
        <p style="color: var(--text-secondary);">Dealer dengan Kode <strong>${code}</strong> belum melakukan submit data profil PIC CRM.</p>
      </div>
    `;
  } else {
    const photoUrl = submission.fotoPicCrm || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
    const emailLink = submission.emailPic ? `<a href="mailto:${submission.emailPic}" style="color: var(--primary);">${submission.emailPic}</a>` : '-';
    const phoneLink = submission.noHpPic ? `<a href="tel:${submission.noHpPic}" style="color: var(--primary);">${submission.noHpPic}</a>` : '-';

    modalBody.innerHTML = `
      <!-- PIC Summary Panel -->
      <div class="profile-summary-bar">
        <img src="${photoUrl}" alt="${submission.namaPicCrm}" class="profile-summary-img">
        <div class="profile-summary-info">
          <div class="profile-summary-title">${submission.namaPicCrm}</div>
          <div class="profile-summary-sub">
            <span><strong>Honda ID:</strong> ${submission.hondaIdPic || '-'}</span>
            <span class="badge-tag">${submission.statusPic || 'Khusus'}</span>
            <span class="badge-tag">Pendidikan: ${submission.pendidikanPic || '-'}</span>
          </div>
          <div style="margin-top: 0.5rem; font-size: 0.88rem; color: var(--text-secondary);">
            <span><strong>Usia PIC:</strong> ${submission.usiaPic || '-'} Tahun</span> | 
            <span><strong>Usia Kerja:</strong> ${submission.lamaKerjaPic || '-'}</span>
          </div>
        </div>
      </div>

      <!-- Detail Grid Panels -->
      <div class="detail-grid">
        
        <!-- Panel 1: Manajemen -->
        <div class="detail-section-card">
          <div class="detail-section-hdr">
            <i class="fa-solid fa-users-gear"></i> Manajemen Dealer
          </div>
          <div class="detail-rows">
            <div class="detail-item">
              <div class="detail-label">Kepala Cabang</div>
              <div class="detail-val">${submission.namaKacab || '-'}</div>
              <div class="detail-label" style="margin-top:0.6rem;">Honda ID / HP / Email</div>
              <div class="detail-val" style="font-size:0.85rem; color: var(--text-secondary);">
                ID: ${submission.hondaIdKacab || '-'}<br>
                HP: ${submission.noHpKacab || '-'}<br>
                Email: ${submission.emailKacab || '-'}
              </div>
            </div>
            
            <div class="detail-item">
              <div class="detail-label">Kepala Bengkel</div>
              <div class="detail-val">${submission.namaKabeng || '-'}</div>
              <div class="detail-label" style="margin-top:0.6rem;">Honda ID / HP / Email</div>
              <div class="detail-val" style="font-size:0.85rem; color: var(--text-secondary);">
                ID: ${submission.hondaIdKabeng || '-'}<br>
                HP: ${submission.noHpKabeng || '-'}<br>
                Email: ${submission.emailKabeng || '-'}
              </div>
            </div>
          </div>
        </div>

        <!-- Panel 2: PIC CRM Contacts -->
        <div class="detail-section-card">
          <div class="detail-section-hdr">
            <i class="fa-solid fa-address-book"></i> Kontak PIC CRM
          </div>
          <div class="detail-rows">
            <div class="detail-item">
              <div class="detail-label">No Telp / HP</div>
              <div class="detail-val">${phoneLink}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Email Resmi</div>
              <div class="detail-val">${emailLink}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Tanggal Lahir</div>
              <div class="detail-val">${formatDate(submission.tanggalLahirPic)}</div>
            </div>
          </div>
        </div>

        <!-- Panel 3: Admin CRM H1 / H2 -->
        <div class="detail-section-card">
          <div class="detail-section-hdr">
            <i class="fa-solid fa-user-group"></i> Struktur Admin CRM H1 &amp; H2
          </div>
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            <div>
              <h5 style="color: #fff; margin-bottom: 0.5rem; font-size: 0.95rem;">Admin CRM H2 (Bengkel) : ${submission.punyaAdminH2}</h5>
              ${submission.punyaAdminH2 === 'Ya' ? `
                <div class="detail-rows">
                  <div class="detail-item">
                    <div class="detail-label">Nama &amp; ID</div>
                    <div class="detail-val">${submission.namaAdminH2 || '-'}</div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">Kontak</div>
                    <div class="detail-val" style="font-size:0.85rem;">
                      HP: ${submission.noHpAdminH2 || '-'}<br>
                      Email: ${submission.emailAdminH2 || '-'}
                    </div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">Profil Kerja</div>
                    <div class="detail-val" style="font-size:0.85rem;">
                      Status: ${submission.statusAdminH2 || '-'}<br>
                      Usia: ${submission.usiaAdminH2 || '-'} Thn | Pendidikan: ${submission.pendidikanAdminH2 || '-'}<br>
                      Lama Kerja: ${submission.lamaKerjaAdminH2 || '-'}
                    </div>
                  </div>
                </div>
              ` : ''}
            </div>
            
            <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1rem;">
              <h5 style="color: #fff; margin-bottom: 0.5rem; font-size: 0.95rem;">Admin CRM H1 (Showroom) : ${submission.punyaAdminH1}</h5>
              ${submission.punyaAdminH1 === 'Ya' ? `
                <div class="detail-rows">
                  <div class="detail-item">
                    <div class="detail-label">Nama &amp; ID</div>
                    <div class="detail-val">${submission.namaAdminH1 || '-'}</div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">Kontak</div>
                    <div class="detail-val" style="font-size:0.85rem;">
                      HP: ${submission.noHpAdminH1 || '-'}<br>
                      Email: ${submission.emailAdminH1 || '-'}
                    </div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">Profil Kerja</div>
                    <div class="detail-val" style="font-size:0.85rem;">
                      Status: ${submission.statusAdminH1 || '-'}<br>
                      Usia: ${submission.usiaAdminH1 || '-'} Thn | Pendidikan: ${submission.pendidikanAdminH1 || '-'}<br>
                      Lama Kerja: ${submission.lamaKerjaAdminH1 || '-'}
                    </div>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Panel 4: Infrastruktur Broadcast -->
        <div class="detail-section-card">
          <div class="detail-section-hdr">
            <i class="fa-solid fa-bullhorn"></i> Infrastruktur Broadcast
          </div>
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            <div>
              <h5 style="color: #fff; margin-bottom: 0.5rem; font-size: 0.95rem;">WhatsApp Broadcast : ${submission.punyaWaBlast === 'Ya' ? 'Memiliki Apps' : 'Tidak Memiliki Apps'}</h5>
              <div class="detail-rows">
                <div class="detail-item">
                  <div class="detail-label">Nama Aplikasi</div>
                  <div class="detail-val">${submission.appsWaBlast || '-'}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">No WA &amp; Status</div>
                  <div class="detail-val">${submission.noWaBroadcast || '-'} (${submission.statusNoWaBroadcast || '-'})</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">WA Business?</div>
                  <div class="detail-val">${submission.isWaBusiness || '-'}</div>
                </div>
              </div>
              <div style="margin-top: 0.6rem;">
                <div class="detail-label">Metode Broadcast WA</div>
                <div class="detail-val" style="font-size: 0.88rem; color: var(--text-secondary);">${submission.caraBroadcastWa || '-'}</div>
              </div>
            </div>

            <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1rem;">
              <h5 style="color: #fff; margin-bottom: 0.5rem; font-size: 0.95rem;">SMS Broadcast : ${submission.punyaSmsBroadcast === 'Ya' ? 'Memiliki Apps' : 'Tidak Memiliki Apps'}</h5>
              <div class="detail-rows">
                <div class="detail-item">
                  <div class="detail-label">Nama Aplikasi SMS</div>
                  <div class="detail-val">${submission.appsSmsBroadcast || '-'}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Metode Broadcast SMS</div>
                  <div class="detail-val" style="font-size: 0.88rem; color: var(--text-secondary);">${submission.caraBroadcastSms || '-'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style="font-size: 0.78rem; color: var(--text-muted); text-align: right; margin-top: 1rem;">
          Data diisi pada: ${new Date(submission.timestamp).toLocaleString('id-ID')}
        </div>

      </div>
    `;
  }

  modal.classList.add('active');
}

// Close Modal
function closeModal() {
  const modal = document.getElementById('detailModal');
  modal.classList.remove('active');
}

// Date Formatter helper
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// Export All Submissions to Excel (.xlsx) using SheetJS
function exportToExcel() {
  if (Object.keys(submissionsList).length === 0) {
    showToast('Belum ada data pengisian dealer yang dapat diekspor.', 'error');
    return;
  }

  showToast('Memproses ekspor data...', 'info');

  const excelRows = [];

  // Loop through all dealer codes in order
  dealerCodes.forEach(code => {
    const dealerInfo = dealersList[code] || { name: `Dealer ${code}` };
    const submission = submissionsList[code];

    if (submission) {
      excelRows.push({
        'Waktu Pengisian (Timestamp)': new Date(submission.timestamp).toLocaleString('id-ID'),
        'Kode Dealer': code,
        'Nama Dealer': dealerInfo.name,
        // Section 1
        'Nama Kepala Cabang': submission.namaKacab || '',
        'Honda ID Kacab': submission.hondaIdKacab || '',
        'No HP Kacab': submission.noHpKacab || '',
        'Email Kacab': submission.emailKacab || '',
        'Nama Kepala Bengkel': submission.namaKabeng || '',
        'Honda ID Kabeng': submission.hondaIdKabeng || '',
        'No HP Kabeng': submission.noHpKabeng || '',
        'Email Kabeng': submission.emailKabeng || '',
        // Section 2
        'Nama PIC CRM': submission.namaPicCrm || '',
        'Honda ID PIC CRM': submission.hondaIdPic || '',
        'No HP PIC CRM': submission.noHpPic || '',
        'Email PIC CRM': submission.emailPic || '',
        'Status PIC CRM': submission.statusPic || '',
        'Tanggal Lahir PIC CRM': submission.tanggalLahirPic || '',
        'Usia PIC CRM': submission.usiaPic || '',
        'Usia Kerja PIC CRM': submission.lamaKerjaPic || '',
        'Pendidikan PIC CRM': submission.pendidikanPic || '',
        'URL Foto PIC CRM': submission.fotoPicCrm ? (submission.fotoPicCrm.startsWith('data:') ? submission.fotoPicCrm : window.location.origin + submission.fotoPicCrm) : '',
        // Section 3: Admin H2
        'Punya Admin H2?': submission.punyaAdminH2 || 'Tidak',
        'Nama Admin H2': submission.namaAdminH2 || '',
        'No HP Admin H2': submission.noHpAdminH2 || '',
        'Email Admin H2': submission.emailAdminH2 || '',
        'Status Admin H2': submission.statusAdminH2 || '',
        'Usia Admin H2': submission.usiaAdminH2 || '',
        'Lama Kerja Admin H2': submission.lamaKerjaAdminH2 || '',
        'Pendidikan Admin H2': submission.pendidikanAdminH2 || '',
        // Section 3: Admin H1
        'Punya Admin H1?': submission.punyaAdminH1 || 'Tidak',
        'Nama Admin H1': submission.namaAdminH1 || '',
        'No HP Admin H1': submission.noHpAdminH1 || '',
        'Email Admin H1': submission.emailAdminH1 || '',
        'Status Admin H1': submission.statusAdminH1 || '',
        'Usia Admin H1': submission.usiaAdminH1 || '',
        'Lama Kerja Admin H1': submission.lamaKerjaAdminH1 || '',
        'Pendidikan Admin H1': submission.pendidikanAdminH1 || '',
        // Section 4: WA Blast
        'Punya WA Blast?': submission.punyaWaBlast || 'Tidak',
        'Aplikasi WA Blast': submission.appsWaBlast || '',
        'No WA Broadcast': submission.noWaBroadcast || '',
        'Status No WA': submission.statusNoWaBroadcast || '',
        'Apakah WA Business?': submission.isWaBusiness || 'Tidak',
        'Cara Broadcast WA': submission.caraBroadcastWa || '',
        // Section 4: SMS
        'Punya SMS Broadcast?': submission.punyaSmsBroadcast || 'Tidak',
        'Aplikasi SMS Broadcast': submission.appsSmsBroadcast || '',
        'Cara Broadcast SMS': submission.caraBroadcastSms || ''
      });
    } else {
      // Append blank records for unfilled dealers so the Excel contains all 220 dealers
      excelRows.push({
        'Waktu Pengisian (Timestamp)': 'BELUM MENGISI',
        'Kode Dealer': code,
        'Nama Dealer': dealerInfo.name,
        // Fill remaining with blanks
        'Nama Kepala Cabang': '', 'Honda ID Kacab': '', 'No HP Kacab': '', 'Email Kacab': '',
        'Nama Kepala Bengkel': '', 'Honda ID Kabeng': '', 'No HP Kabeng': '', 'Email Kabeng': '',
        'Nama PIC CRM': '', 'Honda ID PIC CRM': '', 'No HP PIC CRM': '', 'Email PIC CRM': '',
        'Status PIC CRM': '', 'Tanggal Lahir PIC CRM': '', 'Usia PIC CRM': '', 'Usia Kerja PIC CRM': '',
        'Pendidikan PIC CRM': '', 'URL Foto PIC CRM': '',
        'Punya Admin H2?': 'Tidak', 'Nama Admin H2': '', 'No HP Admin H2': '', 'Email Admin H2': '',
        'Status Admin H2': '', 'Usia Admin H2': '', 'Lama Kerja Admin H2': '', 'Pendidikan Admin H2': '',
        'Punya Admin H1?': 'Tidak', 'Nama Admin H1': '', 'No HP Admin H1': '', 'Email Admin H1': '',
        'Status Admin H1': '', 'Usia Admin H1': '', 'Lama Kerja Admin H1': '', 'Pendidikan Admin H1': '',
        'Punya WA Blast?': 'Tidak', 'Aplikasi WA Blast': '', 'No WA Broadcast': '', 'Status No WA': '',
        'Apakah WA Business?': 'Tidak', 'Cara Broadcast WA': '',
        'Punya SMS Broadcast?': 'Tidak', 'Aplikasi SMS Broadcast': '', 'Cara Broadcast SMS': ''
      });
    }
  });

  try {
    // Generate worksheet & workbook
    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    
    // Set auto widths for columns
    const max_widths = [];
    excelRows.forEach(row => {
      Object.keys(row).forEach((key, col_idx) => {
        const val_len = row[key] ? row[key].toString().length : 0;
        const key_len = key.length;
        const max_len = Math.max(val_len, key_len);
        max_widths[col_idx] = Math.max(max_widths[col_idx] || 0, max_len);
      });
    });
    worksheet['!cols'] = max_widths.map(w => ({ w: w + 3 }));

    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap PIC CRM");

    // Write file
    const timestampStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Rekap_PIC_CRM_Honda_${timestampStr}.xlsx`);
    
    showToast('Ekspor Excel berhasil diunduh.', 'success');
  } catch (error) {
    showToast('Gagal melakukan ekspor Excel: ' + error.message, 'error');
  }
}

// Toast helper functions
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'success' 
    ? '<i class="fa-solid fa-circle-check" style="color: #75b798;"></i>' 
    : type === 'error' 
      ? '<i class="fa-solid fa-circle-exclamation" style="color: #ea868f;"></i>' 
      : '<i class="fa-solid fa-circle-info" style="color: #0d6efd;"></i>';

  toast.innerHTML = `${icon} <span>${message}</span>`;
  container.appendChild(toast);

  // Auto remove toast
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}
