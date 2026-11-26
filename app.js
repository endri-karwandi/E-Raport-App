/**
 * ============================================================================
 * APLIKASI E-RAPOR KURIKULUM MERDEKA (FRONTEND VERCEL / GITHUB)
 * File: app.js
 * ============================================================================
 */

// 1. TEMPELKAN WEB APP URL GOOGLE APPS SCRIPT ANDA DI SINI (ATAU ATUR LEWAT TOMBOL DI HALAMAN LOGIN)
const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/TEMPEL_ID_DEPLOYMENT_ANDA_DI_SINI/exec';

function getGasUrl() {
  const saved = localStorage.getItem('erapor_gas_url');
  if (saved && saved.startsWith('https://script.google.com/')) return saved;
  return DEFAULT_GAS_URL;
}

function saveCustomGasUrl() {
  const val = document.getElementById('inputGasUrlSetup').value.trim();
  if (!val || !val.startsWith('https://script.google.com/')) {
    showToast('Masukkan URL Google Apps Script yang valid (diawali https://script.google.com/...).', 'error');
    return;
  }
  localStorage.setItem('erapor_gas_url', val);
  document.getElementById('gasUrlSetupBox').classList.add('hidden');
  showToast('Koneksi server Google Apps Script berhasil disimpan!', 'success');
}

const APP_STATE = {
  user: null,
  config: {},
  daftarKelas: [],
  mapelList: [],
  ekskulList: [],
  stats: {},
  usersCache: [],
  guruFilter: 'ALL',
  masterSiswaCache: [],
  identitasSiswaCache: [],
  tpCache: [],
  nilaiGridCache: [],
  wkCurrentKelas: '',
  wkBundle: null,
  wkEkskulDraft: {},
  raporBundleCache: null,
  leggerBundleCache: null,
  sortModeActive: false,
  sortableInstances: []
};

const KOKU_TEMPLATES = {
  'Keimanan & Ketakwaan': 'menunjukkan sikap religius, berakhlak mulia, jujur, serta menghormati perbedaan dalam setiap kegiatan pembelajaran dan sosial.',
  'Kewargaan': 'menunjukkan kepedulian sosial, semangat kebangsaan, disiplin terhadap tata tertib, dan tanggung jawab sebagai warga sekolah maupun masyarakat.',
  'Penalaran Kritis': 'mampu menganalisis informasi secara objektif, mengidentifikasi permasalahan, serta mengambil keputusan berdasarkan data dan argumen yang logis.',
  'Kreativitas': 'mampu menghasilkan gagasan orisinal, memodifikasi karya secara inovatif, dan menemukan solusi alternatif dalam menyelesaikan tantangan proyek.',
  'Kolaborasi': 'mampu bekerja sama secara aktif dalam kelompok, menghargai pendapat rekan, serta berbagi peran secara adil untuk mencapai tujuan bersama.',
  'Kemandirian': 'memiliki inisiatif belajar yang tinggi, mampu mengelola waktu dengan baik, serta bertanggung jawab penuh atas proses dan hasil belajarnya.',
  'Kesehatan': 'menjaga kebugaran fisik dan mental, menerapkan pola hidup bersih dan sehat, serta menjaga keseimbangan aktivitas belajar dan istirahat.',
  'Komunikasi': 'mampu menyampaikan ide dan gagasan secara jelas, santun, dan efektif baik secara lisan maupun tulisan kepada berbagai audiens.'
};

const KOKU_DIMENSI_KEYS = Object.keys(KOKU_TEMPLATES);

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function showLoading(msg) {
  document.getElementById('loadingText').textContent = msg || 'Memproses data...';
  const el = document.getElementById('loadingOverlay');
  el.classList.remove('hidden');
  el.classList.add('flex');
}

function hideLoading() {
  const el = document.getElementById('loadingOverlay');
  el.classList.add('hidden');
  el.classList.remove('flex');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const colors = {
    success: 'bg-emerald-600 text-white border-emerald-700',
    error: 'bg-rose-600 text-white border-rose-700',
    warning: 'bg-amber-500 text-white border-amber-600',
    info: 'bg-slate-800 text-white border-slate-900'
  };
  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };
  const div = document.createElement('div');
  div.className = `pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold transition-all ${colors[type] || colors.info}`;
  div.innerHTML = `<i class="fa-solid ${icons[type] || icons.info} mt-0.5 text-sm"></i><div class="flex-1 leading-relaxed">${escapeHtml(message)}</div>`;
  container.appendChild(div);
  setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 300); }, 4200);
}

function openModal(id) {
  const el = document.getElementById(id);
  el.classList.remove('hidden');
  el.classList.add('flex');
}

function closeModal(id) {
  const el = document.getElementById(id);
  el.classList.add('hidden');
  el.classList.remove('flex');
}

function showConfirmDialog(title, message, onConfirm, okLabel = 'Ya, Lanjutkan', hideCancel = false) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  const okBtn = document.getElementById('btnConfirmOk');
  const cancelBtn = document.getElementById('btnConfirmCancel');
  okBtn.textContent = okLabel;
  cancelBtn.style.display = hideCancel ? 'none' : 'inline-block';
  okBtn.onclick = () => { closeModal('modalConfirm'); if (onConfirm) onConfirm(); };
  openModal('modalConfirm');
}

/**
 * HTTP Fetch Bridge ke Google Apps Script Web App doPost(e)
 */
async function callServer(fnName, args = [], loadingMsg = 'Memproses data...') {
  const url = getGasUrl();
  if (!url || url.includes('TEMPEL_ID_DEPLOYMENT_ANDA_DI_SINI')) {
    document.getElementById('gasUrlSetupBox').classList.remove('hidden');
    throw new Error('URL Google Apps Script belum diatur! Tempelkan URL deployment (/exec) Anda terlebih dahulu.');
  }

  if (loadingMsg) showLoading(loadingMsg);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: fnName, args: args })
    });
    const json = await response.json();
    if (!json.ok) {
      throw new Error(json.error || 'Terjadi kesalahan pada server.');
    }
    return json.data;
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    showToast(msg, 'error');
    throw err;
  } finally {
    if (loadingMsg) hideLoading();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const currentUrl = getGasUrl();
  if (currentUrl.includes('TEMPEL_ID_DEPLOYMENT_ANDA_DI_SINI')) {
    document.getElementById('gasUrlSetupBox').classList.remove('hidden');
  } else {
    document.getElementById('inputGasUrlSetup').value = currentUrl;
  }

  const savedUser = sessionStorage.getItem('erapor_user');
  if (savedUser) {
    try {
      APP_STATE.user = JSON.parse(savedUser);
      initAuthenticatedSession();
    } catch (e) {
      sessionStorage.removeItem('erapor_user');
    }
  }
});

function togglePasswordVisibility() {
  const inp = document.getElementById('loginPwd');
  const ico = document.getElementById('pwdEyeIcon');
  if (inp.type === 'password') {
    inp.type = 'text';
    ico.className = 'fa-solid fa-eye-slash';
  } else {
    inp.type = 'password';
    ico.className = 'fa-solid fa-eye';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const id = document.getElementById('loginId').value.trim();
  const pwd = document.getElementById('loginPwd').value.trim();
  try {
    const user = await callServer('loginUser', [id, pwd], 'Memverifikasi akun...');
    APP_STATE.user = user;
    sessionStorage.setItem('erapor_user', JSON.stringify(user));
    showToast('Selamat datang, ' + user.Nama_Lengkap, 'success');
    await initAuthenticatedSession();
  } catch (err) {}
}

function handleLogout() {
  sessionStorage.removeItem('erapor_user');
  APP_STATE.user = null;
  document.getElementById('appShell').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('loginPwd').value = '';
}

async function initAuthenticatedSession() {
  try {
    const bundle = await callServer('getInitialDashboardData', [APP_STATE.user], 'Memuat data sekolah...');
    APP_STATE.user = bundle.user;
    APP_STATE.config = bundle.config;
    APP_STATE.daftarKelas = bundle.daftarKelas || [];
    APP_STATE.mapelList = bundle.mapelList || [];
    APP_STATE.ekskulList = bundle.ekskulList || [];
    APP_STATE.stats = bundle.stats || {};
    sessionStorage.setItem('erapor_user', JSON.stringify(bundle.user));

    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');

    renderHeaderAndSidebar();
    populateGlobalDropdowns();
    renderDashboard();
    navigateTo('dashboard');
  } catch (err) {
    handleLogout();
  }
}

function toggleSidebar(open) {
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sidebarBackdrop');
  if (open) {
    sb.classList.remove('-translate-x-full');
    bd.classList.remove('hidden');
  } else {
    sb.classList.add('-translate-x-full');
    bd.classList.add('hidden');
  }
}

function renderHeaderAndSidebar() {
  const u = APP_STATE.user;
  const c = APP_STATE.config;
  const isAdmin = u.Role === 'Admin';
  const isWali = u.Status_Guru === 'Wali Kelas' && u.Kelas_Perwalian;

  document.getElementById('sidebarJenjangBadge').textContent = 'JENJANG ' + (c.Jenjang || 'SMK');
  document.getElementById('topActivePeriod').textContent = `TA ${c.Tahun_Ajaran_Aktif} • Semester ${c.Semester_Aktif}`;
  document.getElementById('topUserName').textContent = u.Nama_Lengkap;
  document.getElementById('topUserAvatar').textContent = (u.Nama_Lengkap || 'U').charAt(0).toUpperCase();

  let roleLabel = isAdmin ? 'Administrator' : (isWali ? `Wali Kelas ${u.Kelas_Perwalian}` : 'Guru Mapel');
  document.getElementById('topUserRoleBadge').textContent = roleLabel;

  const menus = [
    { group: 'UTAMA', items: [{ id: 'dashboard', label: 'Dashboard', icon: 'fa-house', show: true }] },
    {
      group: 'ADMINISTRASI',
      items: [
        { id: 'profil-sekolah', label: 'Profil Sekolah & TA', icon: 'fa-school', show: isAdmin },
        { id: 'akun-guru', label: 'Manajemen Akun Guru', icon: 'fa-user-gear', show: isAdmin },
        { id: 'data-siswa', label: 'Data Kelas & Siswa', icon: 'fa-users', show: isAdmin || isWali },
        { id: 'identitas-siswa', label: 'Identitas Siswa', icon: 'fa-id-card', show: isAdmin || isWali },
        { id: 'master-mapel', label: 'Master Mata Pelajaran', icon: 'fa-book', show: isAdmin },
        { id: 'master-ekskul', label: 'Master Ekstrakurikuler', icon: 'fa-medal', show: isAdmin }
      ]
    },
    {
      group: 'PENILAIAN AKADEMIK',
      items: [
        { id: 'manajemen-tp', label: 'Tujuan Pembelajaran (TP)', icon: 'fa-bullseye', show: isAdmin || (u.Mapel_Diampu && u.Mapel_Diampu.trim() !== '') },
        { id: 'input-nilai', label: 'Input Nilai & Deskripsi', icon: 'fa-pen-to-square', show: isAdmin || (u.Mapel_Diampu && u.Mapel_Diampu.trim() !== '') }
      ]
    },
    {
      group: 'MENU WALI KELAS',
      items: [
        { id: 'wk-kokurikuler', label: 'Kokurikuler (Narasi)', icon: 'fa-diagram-project', show: isAdmin || isWali },
        { id: 'wk-ekskul', label: 'Ekstrakurikuler', icon: 'fa-trophy', show: isAdmin || isWali },
        { id: 'wk-kehadiran', label: 'Ketidakhadiran', icon: 'fa-calendar-xmark', show: isAdmin || isWali },
        { id: 'wk-catatan', label: 'Catatan Wali Kelas', icon: 'fa-comment-dots', show: isAdmin || isWali },
        { id: 'wk-kelengkapan', label: 'Status Kelengkapan Rapor', icon: 'fa-clipboard-check', show: isAdmin || isWali }
      ]
    },
    {
      group: 'LAPORAN & CETAK',
      items: [
        { id: 'cetak-cover', label: 'Cetak Cover Rapor', icon: 'fa-book-bookmark', show: isAdmin || isWali },
        { id: 'cetak-rapor', label: 'Cetak Rapor & PDF', icon: 'fa-print', show: isAdmin || isWali },
        { id: 'cetak-legger', label: 'Cetak Legger Kelas', icon: 'fa-table-cells', show: isAdmin || isWali }
      ]
    }
  ];

  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = '';
  menus.forEach(grp => {
    const visibleItems = grp.items.filter(i => i.show);
    if (visibleItems.length === 0) return;
    const h = document.createElement('div');
    h.className = 'px-3 pt-4 pb-1 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase';
    h.textContent = grp.group;
    nav.appendChild(h);

    visibleItems.forEach(item => {
      const btn = document.createElement('button');
      btn.id = 'nav-btn-' + item.id;
      btn.onclick = () => { navigateTo(item.id); toggleSidebar(false); };
      btn.className = 'sidebar-nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white font-semibold transition text-left';
      btn.innerHTML = `<i class="fa-solid ${item.icon} w-4 text-center"></i><span class="truncate">${item.label}</span>`;
      nav.appendChild(btn);
    });
  });
}

function navigateTo(viewId) {
  document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
  const target = document.getElementById('view-' + viewId);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.sidebar-nav-btn').forEach(b => b.classList.remove('nav-active'));
  const activeBtn = document.getElementById('nav-btn-' + viewId);
  if (activeBtn) {
    activeBtn.classList.add('nav-active');
    document.getElementById('topPageTitle').textContent = activeBtn.textContent.trim();
  }

  if (viewId === 'profil-sekolah') loadProfilSekolahForm();
  else if (viewId === 'akun-guru') loadUsersData();
  else if (viewId === 'data-siswa') loadMasterSiswaTable();
  else if (viewId === 'identitas-siswa') loadIdentitasTable();
  else if (viewId === 'master-mapel') renderMasterMapelView();
  else if (viewId === 'master-ekskul') loadMasterEkskulTable();
  else if (viewId === 'manajemen-tp') { onChangeTPKelas(); }
  else if (viewId === 'input-nilai') { onChangeNilaiKelas(); }
  else if (viewId.startsWith('wk-')) ensureWaliKelasLoaded(viewId);
  else if (viewId === 'cetak-cover') onChangeCoverKelas();
  else if (viewId === 'cetak-rapor') { restoreRaporOptionPref(); onChangeRaporKelas(); }
  else if (viewId === 'cetak-legger') loadLeggerData();
}

function isMapelApplicableToKelasClient(targetKelasStr, namaKelas) {
  const raw = String(targetKelasStr || '').trim();
  if (!raw || raw.toUpperCase() === 'SEMUA' || raw === '*') return true;
  const kelasUpper = String(namaKelas || '').trim().toUpperCase();
  const tokens = raw.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
  return tokens.some(token => {
    if (token === kelasUpper) return true;
    if (token.includes('*')) {
      const regexStr = '^' + token.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
      return new RegExp(regexStr).test(kelasUpper);
    }
    return false;
  });
}

function populateGlobalDropdowns() {
  const u = APP_STATE.user;
  const isAdmin = u.Role === 'Admin';
  const allKelas = APP_STATE.daftarKelas;

  const kelasMasterSel = document.getElementById('filterKelasMasterSiswa');
  kelasMasterSel.innerHTML = isAdmin ? '<option value="ALL">Semua Kelas</option>' : '';
  const visibleKelasMaster = isAdmin ? allKelas : [u.Kelas_Perwalian].filter(Boolean);
  visibleKelasMaster.forEach(k => { kelasMasterSel.innerHTML += `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`; });

  const waliKelasOptions = isAdmin ? allKelas : [u.Kelas_Perwalian].filter(Boolean);
  ['selectKelasIdentitas', 'coverSelectKelas', 'raporSelectKelas', 'leggerSelectKelas'].forEach(selId => {
    const el = document.getElementById(selId);
    if (!el) return;
    el.innerHTML = '';
    waliKelasOptions.forEach(k => { el.innerHTML += `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`; });
  });

  document.querySelectorAll('.wk-kelas-selector').forEach(sel => {
    sel.innerHTML = '';
    waliKelasOptions.forEach(k => { sel.innerHTML += `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`; });
  });
  if (waliKelasOptions.length > 0 && !APP_STATE.wkCurrentKelas) {
    APP_STATE.wkCurrentKelas = waliKelasOptions[0];
  }

  const guruKelasList = isAdmin ? allKelas : String(u.Kelas_Diampu || '').split(',').map(s => s.trim()).filter(Boolean);
  ['tpSelectKelas', 'nilaiSelectKelas'].forEach(selId => {
    const el = document.getElementById(selId);
    if (!el) return;
    el.innerHTML = '';
    guruKelasList.forEach(k => { el.innerHTML += `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`; });
  });

  updateMapelDropdownForKelas('tpSelectKelas', 'tpSelectMapel');
  updateMapelDropdownForKelas('nilaiSelectKelas', 'nilaiSelectMapel');
}

function updateMapelDropdownForKelas(kelasSelectId, mapelSelectId) {
  const u = APP_STATE.user;
  const isAdmin = u.Role === 'Admin';
  const selectedKelas = document.getElementById(kelasSelectId).value;
  const mapelSel = document.getElementById(mapelSelectId);
  if (!mapelSel) return;

  const baseMapels = isAdmin
    ? APP_STATE.mapelList.filter(m => m.Status === 'Aktif').map(m => m.Nama_Mapel)
    : String(u.Mapel_Diampu || '').split(',').map(s => s.trim()).filter(Boolean);

  const filteredMapels = baseMapels.filter(namaMpl => {
    const meta = APP_STATE.mapelList.find(x => x.Nama_Mapel === namaMpl);
    if (!meta) return true;
    return isMapelApplicableToKelasClient(meta.Target_Kelas, selectedKelas);
  });

  const prevVal = mapelSel.value;
  mapelSel.innerHTML = '';
  if (filteredMapels.length === 0) {
    mapelSel.innerHTML = '<option value="">-- Tidak ada mapel untuk kelas ini --</option>';
  } else {
    filteredMapels.forEach(m => { mapelSel.innerHTML += `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`; });
    if (filteredMapels.includes(prevVal)) mapelSel.value = prevVal;
  }
}

function onChangeTPKelas() {
  updateMapelDropdownForKelas('tpSelectKelas', 'tpSelectMapel');
  loadTPData();
}

function onChangeNilaiKelas() {
  updateMapelDropdownForKelas('nilaiSelectKelas', 'nilaiSelectMapel');
  loadInputNilaiData();
}

function renderDashboard() {
  const u = APP_STATE.user;
  const c = APP_STATE.config;
  const st = APP_STATE.stats;
  const isAdmin = u.Role === 'Admin';
  const isWali = u.Status_Guru === 'Wali Kelas' && u.Kelas_Perwalian;

  document.getElementById('dashSchoolName').textContent = c.Nama_Sekolah || 'SEKOLAH';
  document.getElementById('dashWelcomeTitle').textContent = 'Selamat Datang, ' + u.Nama_Lengkap;
  document.getElementById('dashPeriodPill').textContent = `TA ${c.Tahun_Ajaran_Aktif} - ${c.Semester_Aktif}`;

  document.getElementById('statTotalSiswa').textContent = st.totalSiswa || 0;
  document.getElementById('statTotalKelas').textContent = st.totalKelas || 0;
  document.getElementById('statTotalMapel').textContent = st.totalMapel || 0;
  document.getElementById('statIdentitasIncomplete').textContent = st.identitasBelumLengkap || 0;

  const cardId = document.getElementById('cardIdentitasIncomplete');
  if (!isAdmin && !isWali) cardId.classList.add('hidden');
  else cardId.classList.remove('hidden');

  const shortcuts = [];
  if (isAdmin) {
    shortcuts.push({ label: 'Profil Sekolah', icon: 'fa-school', view: 'profil-sekolah', color: 'bg-sky-50 text-sky-700' });
    shortcuts.push({ label: 'Akun Guru', icon: 'fa-user-gear', view: 'akun-guru', color: 'bg-indigo-50 text-indigo-700' });
    shortcuts.push({ label: 'Master Mapel', icon: 'fa-book', view: 'master-mapel', color: 'bg-emerald-50 text-emerald-700' });
  }
  if (isAdmin || (u.Mapel_Diampu && u.Mapel_Diampu.trim() !== '')) {
    shortcuts.push({ label: 'Tujuan Pembelajaran', icon: 'fa-bullseye', view: 'manajemen-tp', color: 'bg-amber-50 text-amber-700' });
    shortcuts.push({ label: 'Input Nilai', icon: 'fa-pen-to-square', view: 'input-nilai', color: 'bg-sky-50 text-sky-700' });
  }
  if (isAdmin || isWali) {
    shortcuts.push({ label: 'Identitas Siswa', icon: 'fa-id-card', view: 'identitas-siswa', color: 'bg-rose-50 text-rose-700' });
    shortcuts.push({ label: 'Kokurikuler', icon: 'fa-diagram-project', view: 'wk-kokurikuler', color: 'bg-purple-50 text-purple-700' });
    shortcuts.push({ label: 'Cetak Rapor', icon: 'fa-print', view: 'cetak-rapor', color: 'bg-emerald-50 text-emerald-700' });
  }

  document.getElementById('quickShortcutsGrid').innerHTML = shortcuts.map(s => `
    <button onclick="navigateTo('${s.view}')" class="p-3.5 rounded-xl border border-slate-200 hover:border-sky-400 hover:shadow-xs transition flex flex-col items-center justify-center gap-2 text-center bg-white">
      <div class="w-9 h-9 rounded-lg ${s.color} flex items-center justify-center text-sm"><i class="fa-solid ${s.icon}"></i></div>
      <span class="text-[11px] font-bold text-slate-700">${s.label}</span>
    </button>
  `).join('');

  const progList = document.getElementById('dashProgresMapelList');
  if (!st.progresMapel || st.progresMapel.length === 0) {
    progList.innerHTML = '<p class="text-xs text-slate-400 italic">Belum ada data penugasan mata pelajaran.</p>';
  } else {
    progList.innerHTML = st.progresMapel.map(p => {
      const pct = p.Total > 0 ? Math.round((p.Terisi / p.Total) * 100) : 0;
      return `
        <div class="space-y-1">
          <div class="flex justify-between text-xs">
            <span class="font-bold text-slate-700 truncate">${escapeHtml(p.Mapel)} <span class="text-slate-400 font-normal">(${escapeHtml(p.Kelas)})</span></span>
            <span class="font-bold text-sky-700">${p.Terisi}/${p.Total} (${pct}%)</span>
          </div>
          <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full bg-sky-600 rounded-full" style="width:${pct}%"></div>
          </div>
        </div>`;
    }).join('');
  }

  const kelBox = document.getElementById('dashKelengkapanRaporBox');
  const kelList = document.getElementById('dashKelengkapanKelasList');
  if (!st.kelengkapanKelas || st.kelengkapanKelas.length === 0) {
    kelBox.classList.add('hidden');
  } else {
    kelBox.classList.remove('hidden');
    kelList.innerHTML = st.kelengkapanKelas.map(k => `
      <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
        <div class="flex justify-between items-center">
          <span class="font-extrabold text-sm text-slate-800">${escapeHtml(k.Kelas)}</span>
          <span class="text-xs font-bold px-2 py-0.5 rounded-full ${k.Persen === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">${k.Persen}%</span>
        </div>
        <div class="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div class="h-full ${k.Persen === 100 ? 'bg-emerald-500' : 'bg-amber-500'}" style="width:${k.Persen}%"></div>
        </div>
        <p class="text-[11px] text-slate-500">${k.JumlahSiswa} Peserta Didik Terdaftar</p>
      </div>
    `).join('');
  }
}

function loadProfilSekolahForm() {
  const c = APP_STATE.config;
  ['Nama_Sekolah', 'NPSN', 'Jenjang', 'KKM', 'Alamat', 'Kota_Rapor', 'Tanggal_Rapor', 'Kepala_Sekolah', 'NIP_Kepsek', 'Semester_Aktif', 'Tampilkan_Peringkat_Di_Rapor', 'Judul_Cover', 'Subjudul_Cover', 'Instansi_Cover'].forEach(k => {
    const el = document.getElementById('cfg_' + k);
    if (el) el.value = c[k] || '';
  });

  const taSel = document.getElementById('cfg_Tahun_Ajaran_Aktif');
  const taList = String(c.Daftar_Tahun_Ajaran || '2026/2027').split(',').map(s => s.trim()).filter(Boolean);
  if (!taList.includes(c.Tahun_Ajaran_Aktif)) taList.push(c.Tahun_Ajaran_Aktif);
  taSel.innerHTML = taList.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  taSel.value = c.Tahun_Ajaran_Aktif;

  ['Logo_Kiri', 'Logo_Kanan'].forEach(k => {
    const img = document.getElementById('prev_' + k);
    if (c[k]) { img.src = c[k]; img.classList.remove('hidden'); }
    else { img.src = ''; img.classList.add('hidden'); }
  });
  updateCoverLivePreview();
}

function addTahunAjaranOption() {
  const inp = document.getElementById('inputNewTahunAjaran');
  const val = inp.value.trim();
  if (!val) return;
  const sel = document.getElementById('cfg_Tahun_Ajaran_Aktif');
  const exists = Array.from(sel.options).some(o => o.value === val);
  if (!exists) {
    const opt = document.createElement('option');
    opt.value = val; opt.textContent = val;
    sel.appendChild(opt);
  }
  sel.value = val;
  inp.value = '';
  showToast('Tahun Ajaran ' + val + ' ditambahkan. Klik Simpan Pengaturan.', 'info');
}

function handleLogoUpload(e, key) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const imgObj = new Image();
    imgObj.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 220;
      let w = imgObj.width, h = imgObj.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else { w = Math.round((w * maxDim) / h); h = maxDim; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(imgObj, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/png', 0.85);
      APP_STATE.config[key] = dataUrl;
      const prev = document.getElementById('prev_' + key);
      prev.src = dataUrl; prev.classList.remove('hidden');
      updateCoverLivePreview();
    };
    imgObj.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function clearLogo(key) {
  APP_STATE.config[key] = '';
  const prev = document.getElementById('prev_' + key);
  prev.src = ''; prev.classList.add('hidden');
  updateCoverLivePreview();
}

function updateCoverLivePreview() {
  document.getElementById('liveCoverJudul').textContent = document.getElementById('cfg_Judul_Cover').value || 'LAPORAN HASIL BELAJAR';
  document.getElementById('liveCoverSubjudul').textContent = document.getElementById('cfg_Subjudul_Cover').value || '';
  document.getElementById('liveCoverSekolah').textContent = document.getElementById('cfg_Nama_Sekolah').value || 'NAMA SEKOLAH';
  document.getElementById('liveCoverInstansi').textContent = document.getElementById('cfg_Instansi_Cover').value || '';
  const logoSrc = APP_STATE.config.Logo_Kanan || APP_STATE.config.Logo_Kiri || '';
  const img = document.getElementById('liveCoverLogo');
  const ph = document.getElementById('liveCoverLogoPlaceholder');
  if (logoSrc) { img.src = logoSrc; img.classList.remove('hidden'); ph.classList.add('hidden'); }
  else { img.classList.add('hidden'); ph.classList.remove('hidden'); }
}

async function handleSaveConfig(e) {
  e.preventDefault();
  const taSel = document.getElementById('cfg_Tahun_Ajaran_Aktif');
  const allTa = Array.from(taSel.options).map(o => o.value).join(',');
  const payload = {
    Nama_Sekolah: document.getElementById('cfg_Nama_Sekolah').value.trim(),
    NPSN: document.getElementById('cfg_NPSN').value.trim(),
    Jenjang: document.getElementById('cfg_Jenjang').value,
    KKM: document.getElementById('cfg_KKM').value,
    Alamat: document.getElementById('cfg_Alamat').value.trim(),
    Kota_Rapor: document.getElementById('cfg_Kota_Rapor').value.trim(),
    Tanggal_Rapor: document.getElementById('cfg_Tanggal_Rapor').value.trim(),
    Kepala_Sekolah: document.getElementById('cfg_Kepala_Sekolah').value.trim(),
    NIP_Kepsek: document.getElementById('cfg_NIP_Kepsek').value.trim(),
    Tahun_Ajaran_Aktif: taSel.value,
    Daftar_Tahun_Ajaran: allTa,
    Semester_Aktif: document.getElementById('cfg_Semester_Aktif').value,
    Tampilkan_Peringkat_Di_Rapor: document.getElementById('cfg_Tampilkan_Peringkat_Di_Rapor').value,
    Judul_Cover: document.getElementById('cfg_Judul_Cover').value.trim(),
    Subjudul_Cover: document.getElementById('cfg_Subjudul_Cover').value.trim(),
    Instansi_Cover: document.getElementById('cfg_Instansi_Cover').value.trim(),
    Logo_Kiri: APP_STATE.config.Logo_Kiri || '',
    Logo_Kanan: APP_STATE.config.Logo_Kanan || ''
  };
  try {
    const res = await callServer('saveConfigSekolah', [APP_STATE.user, payload], 'Menyimpan konfigurasi sekolah...');
    APP_STATE.config = res.config;
    APP_STATE.wkBundle = null;
    showToast('Pengaturan sekolah & periode aktif berhasil disimpan.', 'success');
    await initAuthenticatedSession();
  } catch (err) {}
}

async function runManualMigration() {
  try {
    const res = await callServer('setupDatabaseSheets', [], 'Memeriksa struktur 12 sheet...');
    showToast(res.message, 'success');
  } catch (err) {}
}

async function loadUsersData() {
  try {
    APP_STATE.usersCache = await callServer('getAllUsers', [APP_STATE.user], 'Memuat daftar akun...');
    renderUsersTable();
  } catch (err) {}
}

function setFilterStatusGuru(status) {
  APP_STATE.guruFilter = status;
  ['ALL', 'Wali Kelas', 'Non Wali Kelas'].forEach(st => {
    const btn = document.getElementById('btnFilterGuru' + (st === 'ALL' ? 'ALL' : (st === 'Wali Kelas' ? 'Wali' : 'Non')));
    if (btn) btn.className = st === status ? 'px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-600 text-white' : 'px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-600';
  });
  renderUsersTable();
}

function renderUsersTable() {
  const q = (document.getElementById('searchGuruInput').value || '').toLowerCase();
  const filtered = APP_STATE.usersCache.filter(u => {
    if (APP_STATE.guruFilter !== 'ALL' && (u.Status_Guru || 'Non Wali Kelas') !== APP_STATE.guruFilter) return false;
    return (u.Nama_Lengkap + ' ' + u.NIP + ' ' + u.ID_User + ' ' + u.Mapel_Diampu).toLowerCase().includes(q);
  });

  const tbody = document.getElementById('tbodyUsers');
  tbody.innerHTML = filtered.map(u => {
    const waliBadge = u.Role === 'Admin'
      ? '<span class="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-[10px]">Administrator</span>'
      : (u.Status_Guru === 'Wali Kelas'
          ? `<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">Wali Kelas (${escapeHtml(u.Kelas_Perwalian)})</span>`
          : '<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold text-[10px]">Non Wali Kelas</span>');
    return `
      <tr class="hover:bg-slate-50">
        <td class="py-3 px-4 font-mono text-[11px]"><div class="font-bold text-slate-800">${escapeHtml(u.ID_User)}</div><div class="text-slate-400">${escapeHtml(u.NIP || '-')}</div></td>
        <td class="py-3 px-4 font-bold text-slate-800">${escapeHtml(u.Nama_Lengkap)}</td>
        <td class="py-3 px-4">${waliBadge}</td>
        <td class="py-3 px-4 max-w-[200px] truncate" title="${escapeHtml(u.Mapel_Diampu)}">${escapeHtml(u.Mapel_Diampu || '-')}</td>
        <td class="py-3 px-4">${escapeHtml(u.Kelas_Diampu || '-')}</td>
        <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${u.Status === 'Aktif' ? 'bg-sky-100 text-sky-700' : 'bg-rose-100 text-rose-700'}">${escapeHtml(u.Status)}</span></td>
        <td class="py-3 px-4 text-right space-x-1">
          <button onclick='openModalUser(${JSON.stringify(u).replace(/'/g, "&#39;")})' class="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg font-bold hover:bg-amber-100">Edit</button>
          <button onclick="confirmDeleteUser('${escapeHtml(u.ID_User)}', '${escapeHtml(u.Nama_Lengkap)}')" class="px-2.5 py-1 bg-rose-50 text-rose-700 rounded-lg font-bold hover:bg-rose-100">Hapus</button>
        </td>
      </tr>`;
  }).join('');
}

function openModalUser(userObj = null) {
  const isEdit = !!userObj;
  document.getElementById('modalUserTitle').textContent = isEdit ? 'Edit Akun Pengguna' : 'Tambah Akun Baru';
  document.getElementById('usr_isEdit').value = isEdit ? '1' : '0';
  const idInp = document.getElementById('usr_ID_User');
  idInp.value = isEdit ? userObj.ID_User : '';
  idInp.readOnly = isEdit;
  document.getElementById('usr_Password').value = isEdit ? userObj.Password : 'guru123';
  document.getElementById('usr_Nama_Lengkap').value = isEdit ? userObj.Nama_Lengkap : '';
  document.getElementById('usr_NIP').value = isEdit ? userObj.NIP : '';
  document.getElementById('usr_Role').value = isEdit ? userObj.Role : 'Guru';
  document.getElementById('usr_Status').value = isEdit ? userObj.Status : 'Aktif';
  document.getElementById('usr_Kelas_Diampu').value = isEdit ? userObj.Kelas_Diampu : '';

  const waliSel = document.getElementById('usr_Kelas_Perwalian');
  waliSel.innerHTML = '<option value="">-- Pilih Kelas --</option>' + APP_STATE.daftarKelas.map(k => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join('');
  if (isEdit && userObj.Kelas_Perwalian) waliSel.value = userObj.Kelas_Perwalian;

  const stGuru = (isEdit && userObj.Status_Guru === 'Wali Kelas') ? 'Wali Kelas' : 'Non Wali Kelas';
  document.querySelectorAll('input[name="usr_Status_Guru"]').forEach(r => { r.checked = r.value === stGuru; });

  const selectedMapels = isEdit ? String(userObj.Mapel_Diampu || '').split(',').map(s => s.trim()) : [];
  const box = document.getElementById('usr_mapelCheckboxes');
  box.innerHTML = APP_STATE.mapelList.filter(m => m.Status === 'Aktif').map(m => `
    <label class="flex items-center gap-1.5 cursor-pointer">
      <input type="checkbox" class="usr-mapel-chk" value="${escapeHtml(m.Nama_Mapel)}" ${selectedMapels.includes(m.Nama_Mapel) ? 'checked' : ''}>
      <span class="truncate">${escapeHtml(m.Nama_Mapel)}</span>
    </label>
  `).join('');

  toggleUserRoleFields();
  toggleKelasPerwalianBox();
  openModal('modalUser');
}

function toggleUserRoleFields() {
  const isGuru = document.getElementById('usr_Role').value === 'Guru';
  document.getElementById('usr_guruFields').classList.toggle('hidden', !isGuru);
}

function toggleKelasPerwalianBox() {
  const checked = document.querySelector('input[name="usr_Status_Guru"]:checked');
  const isWali = checked && checked.value === 'Wali Kelas';
  document.getElementById('usr_kelasPerwalianBox').classList.toggle('hidden', !isWali);
}

async function handleSaveUser(e, replaceExistingWali = false) {
  if (e) e.preventDefault();
  const isEdit = document.getElementById('usr_isEdit').value === '1';
  const stGuruEl = document.querySelector('input[name="usr_Status_Guru"]:checked');
  const checkedMapels = Array.from(document.querySelectorAll('.usr-mapel-chk:checked')).map(c => c.value).join(', ');
  const payload = {
    ID_User: document.getElementById('usr_ID_User').value.trim(),
    Password: document.getElementById('usr_Password').value.trim(),
    Nama_Lengkap: document.getElementById('usr_Nama_Lengkap').value.trim(),
    NIP: document.getElementById('usr_NIP').value.trim(),
    Role: document.getElementById('usr_Role').value,
    Status_Guru: stGuruEl ? stGuruEl.value : 'Non Wali Kelas',
    Kelas_Perwalian: document.getElementById('usr_Kelas_Perwalian').value,
    Mapel_Diampu: checkedMapels,
    Kelas_Diampu: document.getElementById('usr_Kelas_Diampu').value.trim(),
    Status: document.getElementById('usr_Status').value
  };

  try {
    const res = await callServer('saveUserAccount', [APP_STATE.user, payload, isEdit, replaceExistingWali], 'Menyimpan akun...');
    if (res.conflict) {
      showConfirmDialog(
        'Konflik Wali Kelas',
        `Kelas ${res.kelas} saat ini sudah diampu oleh Wali Kelas "${res.existingWaliName}". Apakah Anda ingin menggantinya dengan guru ini?`,
        () => handleSaveUser(null, true)
      );
      return;
    }
    APP_STATE.usersCache = res.users;
    closeModal('modalUser');
    renderUsersTable();
    showToast('Akun pengguna berhasil disimpan.', 'success');
  } catch (err) {}
}

function confirmDeleteUser(idUser, nama) {
  showConfirmDialog('Hapus Akun', `Yakin ingin menghapus akun "${nama}" (${idUser})?`, async () => {
    try {
      const res = await callServer('deleteUserAccount', [APP_STATE.user, idUser], 'Menghapus akun...');
      APP_STATE.usersCache = res.users;
      renderUsersTable();
      showToast('Akun berhasil dihapus.', 'success');
    } catch (err) {}
  });
}

function downloadTemplateGuru() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['ID_User', 'Password', 'Nama_Lengkap', 'NIP', 'Role', 'Wali_Kelas', 'Mapel_Diampu', 'Kelas_Diampu', 'Status'],
    ['guru3', 'guru123', 'Drs. Hendra Wijaya', '197901012006041002', 'Guru', 'X-TKJ-2', 'Matematika, Bahasa Indonesia', 'X-TKJ-1, X-TKJ-2', 'Aktif']
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Template_Guru');
  XLSX.writeFile(wb, 'Template_Import_Akun_Guru.xlsx');
}

function handleImportGuruExcel(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const wb = XLSX.read(ev.target.result, { type: 'binary' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    if (rows.length === 0) return showToast('File Excel kosong.', 'warning');

    document.getElementById('importPreviewTitle').textContent = 'Pratinjau Import Akun Guru';
    document.getElementById('importPreviewSummary').textContent = `Ditemukan ${rows.length} baris akun siap diimpor.`;
    document.getElementById('importPreviewBody').innerHTML = `
      <table class="w-full text-left border-collapse">
        <thead><tr class="bg-slate-100 border-b"><th class="p-2">ID_User</th><th class="p-2">Nama_Lengkap</th><th class="p-2">Wali_Kelas</th><th class="p-2">Mapel_Diampu</th><th class="p-2">Kelas_Diampu</th></tr></thead>
        <tbody class="divide-y">${rows.slice(0, 30).map(r => `<tr><td class="p-2">${escapeHtml(r.ID_User)}</td><td class="p-2">${escapeHtml(r.Nama_Lengkap)}</td><td class="p-2">${escapeHtml(r.Wali_Kelas)}</td><td class="p-2">${escapeHtml(r.Mapel_Diampu)}</td><td class="p-2">${escapeHtml(r.Kelas_Diampu)}</td></tr>`).join('')}</tbody>
      </table>`;
    document.getElementById('btnConfirmImport').onclick = async () => {
      closeModal('modalImportPreview');
      try {
        const res = await callServer('importUsersBatch', [APP_STATE.user, rows], 'Mengimpor akun guru...');
        APP_STATE.usersCache = res.users;
        renderUsersTable();
        showToast(`${res.count} akun guru berhasil diimpor.`, 'success');
      } catch (err) {}
    };
    openModal('modalImportPreview');
  };
  reader.readAsBinaryString(file);
}

async function loadMasterSiswaTable() {
  const isAdmin = APP_STATE.user.Role === 'Admin';
  document.getElementById('adminSiswaActions').classList.toggle('hidden', !isAdmin);
  const kls = document.getElementById('filterKelasMasterSiswa').value || 'ALL';
  try {
    APP_STATE.masterSiswaCache = await callServer('getSiswaByKelas', [APP_STATE.user, kls], 'Memuat data siswa...');
    renderMasterSiswaTable();
  } catch (err) {}
}

function renderMasterSiswaTable() {
  const isAdmin = APP_STATE.user.Role === 'Admin';
  const q = (document.getElementById('searchMasterSiswa').value || '').toLowerCase();
  const filtered = APP_STATE.masterSiswaCache.filter(s => (s.Nama_Siswa + ' ' + s.NISN + ' ' + s.Kelas).toLowerCase().includes(q));
  document.getElementById('tbodyMasterSiswa').innerHTML = filtered.map((s, i) => `
    <tr class="hover:bg-slate-50">
      <td class="py-2.5 px-4 text-slate-500">${i + 1}</td>
      <td class="py-2.5 px-4 font-bold text-sky-700">${escapeHtml(s.Kelas)}</td>
      <td class="py-2.5 px-4 font-mono">${escapeHtml(s.NISN)}</td>
      <td class="py-2.5 px-4 font-mono">${escapeHtml(s.NIS)}</td>
      <td class="py-2.5 px-4 font-bold text-slate-800">${escapeHtml(s.Nama_Siswa)}</td>
      <td class="py-2.5 px-4">${escapeHtml(s.JK)}</td>
      <td class="py-2.5 px-4 text-right space-x-1">
        ${isAdmin ? `
          <button onclick='openModalSiswa(${JSON.stringify(s).replace(/'/g, "&#39;")})' class="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg font-bold">Edit</button>
          <button onclick="confirmDeleteSiswa('${escapeHtml(s.ID_Siswa)}', '${escapeHtml(s.Nama_Siswa)}')" class="px-2.5 py-1 bg-rose-50 text-rose-700 rounded-lg font-bold">Hapus</button>
        ` : '<span class="text-slate-400 italic">Read-only</span>'}
      </td>
    </tr>`).join('');
}

function openModalSiswa(s = null) {
  document.getElementById('modalSiswaTitle').textContent = s ? 'Edit Peserta Didik' : 'Tambah Peserta Didik';
  document.getElementById('sis_ID_Siswa').value = s ? s.ID_Siswa : '';
  document.getElementById('sis_Kelas').value = s ? s.Kelas : '';
  document.getElementById('sis_NISN').value = s ? s.NISN : '';
  document.getElementById('sis_NIS').value = s ? s.NIS : '';
  document.getElementById('sis_Nama_Siswa').value = s ? s.Nama_Siswa : '';
  document.getElementById('sis_JK').value = s ? s.JK : 'L';
  openModal('modalSiswa');
}

async function handleSaveSiswaMaster(e) {
  e.preventDefault();
  const payload = {
    ID_Siswa: document.getElementById('sis_ID_Siswa').value,
    Kelas: document.getElementById('sis_Kelas').value.trim(),
    NISN: document.getElementById('sis_NISN').value.trim(),
    NIS: document.getElementById('sis_NIS').value.trim(),
    Nama_Siswa: document.getElementById('sis_Nama_Siswa').value.trim(),
    JK: document.getElementById('sis_JK').value
  };
  try {
    await callServer('saveSiswaMaster', [APP_STATE.user, payload], 'Menyimpan data siswa...');
    closeModal('modalSiswa');
    showToast('Data siswa berhasil disimpan.', 'success');
    await initAuthenticatedSession();
    loadMasterSiswaTable();
  } catch (err) {}
}

function confirmDeleteSiswa(idSiswa, nama) {
  showConfirmDialog('Hapus Siswa', `Hapus peserta didik "${nama}" dari master kelas?`, async () => {
    try {
      await callServer('deleteSiswaMaster', [APP_STATE.user, idSiswa], 'Menghapus siswa...');
      showToast('Siswa berhasil dihapus.', 'success');
      await initAuthenticatedSession();
      loadMasterSiswaTable();
    } catch (err) {}
  });
}

function downloadTemplateSiswa() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Kelas', 'NISN', 'NIS', 'Nama_Siswa', 'JK'],
    ['X-TKJ-1', '0081234599', '26099', 'Dimas Anggara Putra', 'L']
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Template_Siswa');
  XLSX.writeFile(wb, 'Template_Import_Master_Siswa.xlsx');
}

function handleImportSiswaExcel(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const wb = XLSX.read(ev.target.result, { type: 'binary' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    if (rows.length === 0) return showToast('File Excel kosong.', 'warning');
    document.getElementById('importPreviewTitle').textContent = 'Pratinjau Import Master Siswa';
    document.getElementById('importPreviewSummary').textContent = `Ditemukan ${rows.length} baris peserta didik.`;
    document.getElementById('importPreviewBody').innerHTML = `
      <table class="w-full text-left border-collapse">
        <thead><tr class="bg-slate-100 border-b"><th class="p-2">Kelas</th><th class="p-2">NISN</th><th class="p-2">NIS</th><th class="p-2">Nama_Siswa</th><th class="p-2">JK</th></tr></thead>
        <tbody class="divide-y">${rows.slice(0, 30).map(r => `<tr><td class="p-2">${escapeHtml(r.Kelas)}</td><td class="p-2">${escapeHtml(r.NISN)}</td><td class="p-2">${escapeHtml(r.NIS)}</td><td class="p-2">${escapeHtml(r.Nama_Siswa)}</td><td class="p-2">${escapeHtml(r.JK)}</td></tr>`).join('')}</tbody>
      </table>`;
    document.getElementById('btnConfirmImport').onclick = async () => {
      closeModal('modalImportPreview');
      try {
        const res = await callServer('importSiswaMasterBatch', [APP_STATE.user, rows], 'Mengimpor master siswa...');
        showToast(`${res.count} peserta didik berhasil diimpor.`, 'success');
        await initAuthenticatedSession();
        loadMasterSiswaTable();
      } catch (err) {}
    };
    openModal('modalImportPreview');
  };
  reader.readAsBinaryString(file);
}

const IDENTITAS_POKOK_FIELDS = ['Nama_Siswa', 'NISN', 'NIS', 'JK', 'Tempat_Lahir', 'Tanggal_Lahir', 'Agama', 'Alamat_Siswa', 'Nama_Ayah', 'Nama_Ibu'];
const IDENTITAS_ALL_FIELDS = [
  'NISN', 'NIS', 'Nama_Siswa', 'JK', 'Tempat_Lahir', 'Tanggal_Lahir', 'Agama',
  'Status_Dalam_Keluarga', 'Anak_Ke', 'Alamat_Siswa', 'No_Telp_Siswa',
  'Sekolah_Asal', 'Diterima_Di_Kelas', 'Tanggal_Diterima', 'Nama_Ayah',
  'Nama_Ibu', 'Pekerjaan_Ayah', 'Pekerjaan_Ibu', 'Alamat_Orang_Tua',
  'No_Telp_Orang_Tua', 'Nama_Wali', 'Pekerjaan_Wali', 'Alamat_Wali', 'No_Telp_Wali'
];

function checkIdentitasPokokStatus(siswaObj) {
  const merged = Object.assign({}, siswaObj, siswaObj.identitas || {});
  const missing = IDENTITAS_POKOK_FIELDS.filter(f => !String(merged[f] || '').trim());
  const filledAll = IDENTITAS_ALL_FIELDS.filter(f => String(merged[f] || '').trim() !== '').length;
  return { isComplete: missing.length === 0, missing, filledAll, totalAll: IDENTITAS_ALL_FIELDS.length };
}

async function loadIdentitasTable() {
  const kls = document.getElementById('selectKelasIdentitas').value;
  if (!kls) return;
  try {
    APP_STATE.identitasSiswaCache = await callServer('getSiswaByKelas', [APP_STATE.user, kls], 'Memuat identitas siswa...');
    renderIdentitasTable();
  } catch (err) {}
}

function renderIdentitasTable() {
  document.getElementById('tbodyIdentitasSiswa').innerHTML = APP_STATE.identitasSiswaCache.map((s, i) => {
    const st = checkIdentitasPokokStatus(s);
    const pct = Math.round((st.filledAll / st.totalAll) * 100);
    return `
      <tr class="hover:bg-slate-50">
        <td class="py-3 px-3 text-slate-500">${i + 1}</td>
        <td class="py-3 px-3 font-bold text-slate-800">${escapeHtml(s.Nama_Siswa)}</td>
        <td class="py-3 px-3 font-mono text-[11px]">${escapeHtml(s.NISN)} / ${escapeHtml(s.NIS || '-')}</td>
        <td class="py-3 px-3">${escapeHtml(s.JK)}</td>
        <td class="py-3 px-3"><span class="font-bold text-sky-700">${st.filledAll}/${st.totalAll} kolom</span> (${pct}%)</td>
        <td class="py-3 px-3">
          ${st.isComplete
            ? '<span class="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]"><i class="fa-solid fa-check mr-1"></i>Lengkap</span>'
            : `<span class="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]" title="Kurang: ${st.missing.join(', ')}"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Kurang ${st.missing.length} Data Pokok</span>`
          }
        </td>
        <td class="py-3 px-3 text-right">
          <button onclick='openModalIdentitas(${JSON.stringify(s).replace(/'/g, "&#39;")})' class="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold">Lengkapi Biodata</button>
        </td>
      </tr>`;
  }).join('');
}

function openModalIdentitas(siswaObj) {
  const merged = Object.assign({}, siswaObj, siswaObj.identitas || {});
  IDENTITAS_ALL_FIELDS.forEach(f => {
    const el = document.getElementById('id_' + f);
    if (el) el.value = merged[f] || '';
  });
  openModal('modalIdentitas');
}

async function handleSaveIdentitas(e) {
  e.preventDefault();
  const kls = document.getElementById('selectKelasIdentitas').value;
  const payload = {};
  IDENTITAS_ALL_FIELDS.forEach(f => {
    const el = document.getElementById('id_' + f);
    payload[f] = el ? el.value.trim() : '';
  });
  try {
    await callServer('saveIdentitasSiswa', [APP_STATE.user, kls, payload], 'Menyimpan biodata siswa...');
    closeModal('modalIdentitas');
    APP_STATE.wkBundle = null;
    showToast('Identitas peserta didik berhasil diperbarui.', 'success');
    loadIdentitasTable();
  } catch (err) {}
}

function downloadTemplateIdentitas() {
  const wb = XLSX.utils.book_new();
  const rows = [IDENTITAS_ALL_FIELDS];
  APP_STATE.identitasSiswaCache.forEach(s => {
    const m = Object.assign({}, s, s.identitas || {});
    rows.push(IDENTITAS_ALL_FIELDS.map(h => m[h] || ''));
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Identitas_Siswa');
  XLSX.writeFile(wb, `Identitas_Siswa_${document.getElementById('selectKelasIdentitas').value}.xlsx`);
}

function handleImportIdentitasExcel(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const kls = document.getElementById('selectKelasIdentitas').value;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const wb = XLSX.read(ev.target.result, { type: 'binary' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    if (rows.length === 0) return showToast('File Excel kosong.', 'warning');

    document.getElementById('importPreviewTitle').textContent = `Pratinjau Import Identitas Kelas ${kls}`;
    document.getElementById('importPreviewSummary').textContent = `Ditemukan ${rows.length} baris data biodata. Kolom kosong di Excel tidak akan menimpa data yang sudah ada.`;
    document.getElementById('importPreviewBody').innerHTML = `
      <table class="w-full text-left border-collapse">
        <thead><tr class="bg-slate-100 border-b"><th class="p-2">NISN</th><th class="p-2">Nama_Siswa</th><th class="p-2">Tempat_Lahir</th><th class="p-2">Tanggal_Lahir</th><th class="p-2">Nama_Ayah</th><th class="p-2">Nama_Ibu</th></tr></thead>
        <tbody class="divide-y">${rows.slice(0, 30).map(r => `<tr><td class="p-2">${escapeHtml(r.NISN)}</td><td class="p-2">${escapeHtml(r.Nama_Siswa)}</td><td class="p-2">${escapeHtml(r.Tempat_Lahir)}</td><td class="p-2">${escapeHtml(r.Tanggal_Lahir)}</td><td class="p-2">${escapeHtml(r.Nama_Ayah)}</td><td class="p-2">${escapeHtml(r.Nama_Ibu)}</td></tr>`).join('')}</tbody>
      </table>`;
    document.getElementById('btnConfirmImport').onclick = async () => {
      closeModal('modalImportPreview');
      try {
        const res = await callServer('importIdentitasBatch', [APP_STATE.user, kls, rows], 'Mengimpor identitas siswa...');
        APP_STATE.wkBundle = null;
        showToast(`${res.updated} biodata siswa berhasil diperbarui.`, 'success');
        loadIdentitasTable();
      } catch (err) {}
    };
    openModal('modalImportPreview');
  };
  reader.readAsBinaryString(file);
}

function renderMasterMapelView() {
  const container = document.getElementById('mapelNormalView');
  const groups = [
    { key: 'Umum', title: 'A. Kelompok Mata Pelajaran Umum', badge: 'bg-indigo-100 text-indigo-800' },
    { key: 'Kejuruan', title: 'B. Kelompok Mata Pelajaran Kejuruan', badge: 'bg-sky-100 text-sky-800' },
    { key: 'Pilihan', title: 'C. Kelompok Mata Pelajaran Pilihan', badge: 'bg-emerald-100 text-emerald-800' }
  ];

  container.innerHTML = groups.map(g => {
    const items = APP_STATE.mapelList.filter(m => (m.Kelompok_Mapel || 'Umum') === g.key);
    return `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div class="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h4 class="text-xs font-extrabold uppercase text-slate-800">${g.title}</h4>
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${g.badge}">${items.length} Mapel</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead><tr class="border-b border-slate-100 text-slate-500 uppercase text-[11px]"><th class="py-2.5 px-4 w-16">Urutan</th><th class="py-2.5 px-4">Nama Mata Pelajaran</th><th class="py-2.5 px-4 w-28">Singkatan</th><th class="py-2.5 px-4">Target Kelas / Jurusan</th><th class="py-2.5 px-4 w-24">Status</th><th class="py-2.5 px-4 w-32 text-right">Aksi</th></tr></thead>
            <tbody class="divide-y divide-slate-100">
              ${items.length === 0 ? '<tr><td colspan="6" class="py-4 px-4 text-center text-slate-400 italic">Belum ada mata pelajaran pada kelompok ini.</td></tr>' : items.map(m => `
                <tr class="hover:bg-slate-50">
                  <td class="py-2.5 px-4 font-bold text-slate-500">${m.Urutan}</td>
                  <td class="py-2.5 px-4 font-bold text-slate-800">${escapeHtml(m.Nama_Mapel)}</td>
                  <td class="py-2.5 px-4 font-mono font-bold text-sky-700">${escapeHtml(m.Singkatan)}</td>
                  <td class="py-2.5 px-4">${m.Target_Kelas ? `<span class="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono text-[11px] font-bold">${escapeHtml(m.Target_Kelas)}</span>` : '<span class="text-slate-400 text-[11px]">Semua Kelas</span>'}</td>
                  <td class="py-2.5 px-4"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${m.Status === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">${escapeHtml(m.Status)}</span></td>
                  <td class="py-2.5 px-4 text-right space-x-1">
                    <button onclick='openModalMapel(${JSON.stringify(m).replace(/'/g, "&#39;")})' class="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg font-bold">Edit</button>
                    <button onclick="confirmDeleteMapel('${escapeHtml(m.ID_Mapel)}', '${escapeHtml(m.Nama_Mapel)}')" class="px-2.5 py-1 bg-rose-50 text-rose-700 rounded-lg font-bold">Hapus</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }).join('');
}

function openModalMapel(m = null) {
  document.getElementById('modalMapelTitle').textContent = m ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran';
  document.getElementById('mpl_ID_Mapel').value = m ? m.ID_Mapel : '';
  document.getElementById('mpl_Nama_Mapel').value = m ? m.Nama_Mapel : '';
  document.getElementById('mpl_Singkatan').value = m ? m.Singkatan : '';
  document.getElementById('mpl_Urutan').value = m ? m.Urutan : '';
  document.getElementById('mpl_Kelompok_Mapel').value = m ? m.Kelompok_Mapel : 'Umum';
  document.getElementById('mpl_Target_Kelas').value = m ? (m.Target_Kelas || '') : '';
  document.getElementById('mpl_Status').value = m ? m.Status : 'Aktif';
  openModal('modalMapel');
}

async function handleSaveMapel(e) {
  e.preventDefault();
  const payload = {
    ID_Mapel: document.getElementById('mpl_ID_Mapel').value,
    Nama_Mapel: document.getElementById('mpl_Nama_Mapel').value.trim(),
    Singkatan: document.getElementById('mpl_Singkatan').value.trim().toUpperCase(),
    Urutan: document.getElementById('mpl_Urutan').value,
    Kelompok_Mapel: document.getElementById('mpl_Kelompok_Mapel').value,
    Target_Kelas: document.getElementById('mpl_Target_Kelas').value.trim(),
    Status: document.getElementById('mpl_Status').value
  };
  try {
    const res = await callServer('saveMapel', [APP_STATE.user, payload], 'Menyimpan mata pelajaran...');
    APP_STATE.mapelList = res.mapelList;
    APP_STATE.wkBundle = null;
    closeModal('modalMapel');
    renderMasterMapelView();
    populateGlobalDropdowns();
    showToast('Mata pelajaran berhasil disimpan.', 'success');
  } catch (err) {}
}

function confirmDeleteMapel(idMapel, nama) {
  showConfirmDialog('Hapus Mata Pelajaran', `Hapus mata pelajaran "${nama}"?`, async () => {
    try {
      const res = await callServer('deleteMapel', [APP_STATE.user, idMapel], 'Menghapus mapel...');
      APP_STATE.mapelList = res.mapelList;
      APP_STATE.wkBundle = null;
      renderMasterMapelView();
      populateGlobalDropdowns();
      showToast('Mata pelajaran berhasil dihapus.', 'success');
    } catch (err) {}
  });
}

function downloadTemplateMapel() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Nama_Mapel', 'Singkatan', 'Kelompok_Mapel', 'Urutan', 'Status', 'Target_Kelas'],
    ['Bahasa Inggris', 'B.ING', 'Umum', 50, 'Aktif', ''],
    ['Administrasi Infrastruktur Jaringan', 'AIJ', 'Kejuruan', 30, 'Aktif', 'XI-TKJ-*, XII-TKJ-*']
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Template_Mapel');
  XLSX.writeFile(wb, 'Template_Import_Mapel.xlsx');
}

function handleImportMapelExcel(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const wb = XLSX.read(ev.target.result, { type: 'binary' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    if (rows.length === 0) return showToast('File Excel kosong.', 'warning');
    document.getElementById('importPreviewTitle').textContent = 'Pratinjau Import Mata Pelajaran';
    document.getElementById('importPreviewSummary').textContent = `Ditemukan ${rows.length} baris mata pelajaran.`;
    document.getElementById('importPreviewBody').innerHTML = `
      <table class="w-full text-left border-collapse">
        <thead><tr class="bg-slate-100 border-b"><th class="p-2">Nama_Mapel</th><th class="p-2">Singkatan</th><th class="p-2">Kelompok</th><th class="p-2">Target_Kelas</th></tr></thead>
        <tbody class="divide-y">${rows.slice(0, 30).map(r => `<tr><td class="p-2">${escapeHtml(r.Nama_Mapel)}</td><td class="p-2">${escapeHtml(r.Singkatan)}</td><td class="p-2">${escapeHtml(r.Kelompok_Mapel)}</td><td class="p-2">${escapeHtml(r.Target_Kelas || 'Semua')}</td></tr>`).join('')}</tbody>
      </table>`;
    document.getElementById('btnConfirmImport').onclick = async () => {
      closeModal('modalImportPreview');
      try {
        const res = await callServer('importMapelBatch', [APP_STATE.user, rows], 'Mengimpor mata pelajaran...');
        APP_STATE.mapelList = res.mapelList;
        APP_STATE.wkBundle = null;
        renderMasterMapelView();
        populateGlobalDropdowns();
        showToast('Mata pelajaran berhasil diimpor.', 'success');
      } catch (err) {}
    };
    openModal('modalImportPreview');
  };
  reader.readAsBinaryString(file);
}

function toggleModeUrutanMapel() {
  if (APP_STATE.sortModeActive) {
    cancelModeUrutanMapel(true);
    return;
  }
  APP_STATE.sortModeActive = true;
  document.getElementById('mapelNormalView').classList.add('hidden');
  document.getElementById('mapelSortView').classList.remove('hidden');

  ['Umum', 'Kejuruan', 'Pilihan'].forEach(grp => {
    const container = document.getElementById('sortList-' + grp);
    const items = APP_STATE.mapelList.filter(m => (m.Kelompok_Mapel || 'Umum') === grp);
    container.innerHTML = items.map(m => `
      <div data-id="${escapeHtml(m.ID_Mapel)}" class="sort-mapel-card bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2 cursor-move">
        <div class="flex items-center gap-2.5 min-w-0">
          <i class="fa-solid fa-grip-vertical text-slate-400"></i>
          <span class="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-bold text-slate-700">${escapeHtml(m.Singkatan)}</span>
          <span class="text-xs font-bold text-slate-800 truncate">${escapeHtml(m.Nama_Mapel)}</span>
        </div>
        <div class="flex gap-1 shrink-0">
          <button type="button" onclick="moveMapelCard(this, -1)" class="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px]">▲</button>
          <button type="button" onclick="moveMapelCard(this, 1)" class="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px]">▼</button>
        </div>
      </div>`).join('');

    if (typeof Sortable !== 'undefined') {
      const inst = Sortable.create(container, { group: 'mapelGroups', animation: 150, ghostClass: 'sortable-ghost' });
      APP_STATE.sortableInstances.push(inst);
    }
  });
}

function moveMapelCard(btn, dir) {
  const card = btn.closest('.sort-mapel-card');
  if (!card) return;
  if (dir === -1 && card.previousElementSibling) card.parentNode.insertBefore(card, card.previousElementSibling);
  else if (dir === 1 && card.nextElementSibling) card.parentNode.insertBefore(card.nextElementSibling, card);
}

function cancelModeUrutanMapel(reset) {
  APP_STATE.sortableInstances.forEach(inst => { try { inst.destroy(); } catch (e) {} });
  APP_STATE.sortableInstances = [];
  APP_STATE.sortModeActive = false;
  document.getElementById('mapelSortView').classList.add('hidden');
  document.getElementById('mapelNormalView').classList.remove('hidden');
  if (reset) renderMasterMapelView();
}

async function saveUrutanMapelToServer() {
  const updates = [];
  ['Umum', 'Kejuruan', 'Pilihan'].forEach(grp => {
    const cards = document.querySelectorAll(`#sortList-${grp} .sort-mapel-card`);
    cards.forEach((c, idx) => {
      updates.push({ ID_Mapel: c.getAttribute('data-id'), Kelompok_Mapel: grp, Urutan: (idx + 1) * 10 });
    });
  });
  try {
    const res = await callServer('saveUrutanMapel', [APP_STATE.user, updates], 'Menyimpan urutan mata pelajaran...');
    APP_STATE.mapelList = res.mapelList;
    APP_STATE.wkBundle = null;
    cancelModeUrutanMapel(true);
    showToast('Urutan mata pelajaran berhasil disimpan & disinkronkan.', 'success');
  } catch (err) {}
}

async function loadMasterEkskulTable() {
  try {
    APP_STATE.ekskulList = await callServer('getAllEkskul', [APP_STATE.user], 'Memuat master ekstrakurikuler...');
    document.getElementById('tbodyMasterEkskul').innerHTML = APP_STATE.ekskulList.map(e => `
      <tr class="hover:bg-slate-50">
        <td class="py-3 px-4 font-mono text-slate-500">${escapeHtml(e.ID_Ekskul)}</td>
        <td class="py-3 px-4 font-bold text-slate-800">${escapeHtml(e.Nama_Ekskul)}</td>
        <td class="py-3 px-4">${escapeHtml(e.Pembina || '-')}</td>
        <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${e.Status === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">${escapeHtml(e.Status)}</span></td>
        <td class="py-3 px-4 text-right space-x-1">
          <button onclick='openModalMasterEkskul(${JSON.stringify(e).replace(/'/g, "&#39;")})' class="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg font-bold">Edit</button>
          <button onclick="confirmDeleteMasterEkskul('${escapeHtml(e.ID_Ekskul)}', '${escapeHtml(e.Nama_Ekskul)}')" class="px-2.5 py-1 bg-rose-50 text-rose-700 rounded-lg font-bold">Hapus</button>
        </td>
      </tr>`).join('');
  } catch (err) {}
}

function openModalMasterEkskul(e = null) {
  document.getElementById('eks_ID_Ekskul').value = e ? e.ID_Ekskul : '';
  document.getElementById('eks_Nama_Ekskul').value = e ? e.Nama_Ekskul : '';
  document.getElementById('eks_Pembina').value = e ? e.Pembina : '';
  document.getElementById('eks_Status').value = e ? e.Status : 'Aktif';
  openModal('modalMasterEkskul');
}

async function handleSaveMasterEkskul(ev) {
  ev.preventDefault();
  const payload = {
    ID_Ekskul: document.getElementById('eks_ID_Ekskul').value,
    Nama_Ekskul: document.getElementById('eks_Nama_Ekskul').value.trim(),
    Pembina: document.getElementById('eks_Pembina').value.trim(),
    Status: document.getElementById('eks_Status').value
  };
  try {
    const res = await callServer('saveMasterEkskul', [APP_STATE.user, payload], 'Menyimpan ekstrakurikuler...');
    APP_STATE.ekskulList = res.ekskulList;
    closeModal('modalMasterEkskul');
    loadMasterEkskulTable();
    showToast('Master ekstrakurikuler berhasil disimpan.', 'success');
  } catch (err) {}
}

function confirmDeleteMasterEkskul(idEks, nama) {
  showConfirmDialog('Hapus Ekstrakurikuler', `Hapus "${nama}" dari daftar ekstrakurikuler?`, async () => {
    try {
      const res = await callServer('deleteMasterEkskul', [APP_STATE.user, idEks], 'Menghapus data...');
      APP_STATE.ekskulList = res.ekskulList;
      loadMasterEkskulTable();
      showToast('Ekstrakurikuler dihapus.', 'success');
    } catch (err) {}
  });
}

async function loadTPData() {
  const kls = document.getElementById('tpSelectKelas').value;
  const mpl = document.getElementById('tpSelectMapel').value;
  const meta = APP_STATE.mapelList.find(m => m.Nama_Mapel === mpl);
  document.getElementById('tpKelompokInfo').textContent = 'Kelompok Mapel: ' + (meta ? meta.Kelompok_Mapel : '-');
  if (!kls || !mpl) {
    document.getElementById('tbodyTP').innerHTML = '<tr><td colspan="4" class="py-6 text-center text-slate-400 italic">Pilih kelas dan mata pelajaran yang sesuai.</td></tr>';
    return;
  }

  try {
    APP_STATE.tpCache = await callServer('getTPList', [APP_STATE.user, kls, mpl], 'Memuat Tujuan Pembelajaran...');
    const tbody = document.getElementById('tbodyTP');
    if (APP_STATE.tpCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-slate-400 italic">Belum ada Tujuan Pembelajaran untuk kelas & mapel ini. Klik "+ Tambah TP".</td></tr>';
      return;
    }
    tbody.innerHTML = APP_STATE.tpCache.map(t => `
      <tr class="hover:bg-slate-50">
        <td class="py-3 px-4 font-mono font-bold text-sky-700">${escapeHtml(t.Kode_TP)}</td>
        <td class="py-3 px-4 text-slate-800">${escapeHtml(t.Deskripsi_TP)}</td>
        <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">${escapeHtml(t.Kelompok_Mapel)}</span></td>
        <td class="py-3 px-4 text-right space-x-1">
          <button onclick='openModalTP(${JSON.stringify(t).replace(/'/g, "&#39;")})' class="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg font-bold">Edit</button>
          <button onclick="confirmDeleteTP('${escapeHtml(t.ID_TP)}', '${escapeHtml(t.Kode_TP)}')" class="px-2.5 py-1 bg-rose-50 text-rose-700 rounded-lg font-bold">Hapus</button>
        </td>
      </tr>`).join('');
  } catch (err) {}
}

function openModalTP(tp = null) {
  document.getElementById('tp_ID_TP').value = tp ? tp.ID_TP : '';
  document.getElementById('tp_Kode_TP').value = tp ? tp.Kode_TP : `TP.${APP_STATE.tpCache.length + 1}`;
  document.getElementById('tp_Deskripsi_TP').value = tp ? tp.Deskripsi_TP : '';
  openModal('modalTP');
}

async function handleSaveTP(e) {
  e.preventDefault();
  const payload = {
    ID_TP: document.getElementById('tp_ID_TP').value,
    Kelas: document.getElementById('tpSelectKelas').value,
    Mapel: document.getElementById('tpSelectMapel').value,
    Kode_TP: document.getElementById('tp_Kode_TP').value.trim(),
    Deskripsi_TP: document.getElementById('tp_Deskripsi_TP').value.trim()
  };
  try {
    const res = await callServer('saveTP', [APP_STATE.user, payload], 'Menyimpan TP...');
    APP_STATE.tpCache = res.tpList;
    closeModal('modalTP');
    loadTPData();
    showToast('Tujuan Pembelajaran berhasil disimpan.', 'success');
  } catch (err) {}
}

function confirmDeleteTP(idTp, kode) {
  const kls = document.getElementById('tpSelectKelas').value;
  const mpl = document.getElementById('tpSelectMapel').value;
  showConfirmDialog('Hapus TP', `Yakin menghapus ${kode}?`, async () => {
    try {
      await callServer('deleteTP', [APP_STATE.user, idTp, kls, mpl], 'Menghapus TP...');
      loadTPData();
      showToast('TP dihapus.', 'success');
    } catch (err) {}
  });
}

async function loadInputNilaiData() {
  const kls = document.getElementById('nilaiSelectKelas').value;
  const mpl = document.getElementById('nilaiSelectMapel').value;
  if (!kls || !mpl) {
    document.getElementById('tbodyInputNilai').innerHTML = '<tr><td colspan="8" class="py-6 text-center text-slate-400 italic">Pilih kelas dan mata pelajaran yang sesuai.</td></tr>';
    return;
  }

  try {
    const res = await callServer('getNilaiKelasMapel', [APP_STATE.user, kls, mpl], 'Memuat lembar penilaian...');
    APP_STATE.nilaiGridCache = res.siswaNilai || [];
    APP_STATE.tpCache = res.tpList || [];
    document.getElementById('nilaiTpCount').textContent = APP_STATE.tpCache.length;
    renderInputNilaiTable();
  } catch (err) {}
}

function calcPredikatClient(na) {
  if (na >= 90) return 'A';
  if (na >= 80) return 'B';
  if (na >= 70) return 'C';
  return 'D';
}

function composeDeskripsiCapaianClient(namaSiswa, na, tpList) {
  if (!tpList || tpList.length === 0) return '';
  const tpTexts = tpList.map(t => String(t.Deskripsi_TP || '').replace(/^peserta didik mampu\s+/i, '').replace(/\.$/, '').trim()).filter(Boolean);
  if (tpTexts.length === 0) return '';

  const tpGabung = tpTexts.join(', ');
  if (na >= 90) return `Menunjukkan penguasaan yang sangat baik dalam ${tpGabung}.`;
  if (na >= 80) return `Menunjukkan penguasaan yang baik dalam ${tpGabung}.`;
  if (na >= 70) return `Menunjukkan penguasaan yang cukup dalam ${tpGabung}, serta perlu penguatan pada latihan terstruktur.`;
  return `Memerlukan bimbingan dan pendampingan lebih lanjut dalam ${tpGabung}.`;
}

function renderInputNilaiTable() {
  const tbody = document.getElementById('tbodyInputNilai');
  tbody.innerHTML = APP_STATE.nilaiGridCache.map((row, idx) => `
    <tr class="hover:bg-slate-50">
      <td class="py-2 px-2 text-slate-500">${idx + 1}</td>
      <td class="py-2 px-2 font-mono text-[11px]">${escapeHtml(row.NISN)}</td>
      <td class="py-2 px-2 font-bold text-slate-800">${escapeHtml(row.Nama_Siswa)}</td>
      <td class="py-2 px-2 text-center"><input type="number" min="0" max="100" step="1" value="${escapeHtml(row.Formatif)}" oninput="onEditNilaiCell(${idx}, 'Formatif', this.value)" class="w-20 text-center px-2 py-1.5 border border-slate-300 rounded-lg font-bold"></td>
      <td class="py-2 px-2 text-center"><input type="number" min="0" max="100" step="1" value="${escapeHtml(row.Sumatif)}" oninput="onEditNilaiCell(${idx}, 'Sumatif', this.value)" class="w-20 text-center px-2 py-1.5 border border-slate-300 rounded-lg font-bold"></td>
      <td class="py-2 px-2 text-center font-extrabold text-sm text-sky-700" id="cell-na-${idx}">${row.Nilai_Akhir !== '' ? row.Nilai_Akhir : '-'}</td>
      <td class="py-2 px-2 text-center font-extrabold" id="cell-pred-${idx}">${row.Predikat || '-'}</td>
      <td class="py-2 px-2"><textarea rows="2" id="cell-desc-${idx}" onchange="APP_STATE.nilaiGridCache[${idx}].Deskripsi_Capaian = this.value" class="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-[11px] leading-snug">${escapeHtml(row.Deskripsi_Capaian)}</textarea></td>
    </tr>`).join('');
}

function onEditNilaiCell(idx, field, val) {
  const row = APP_STATE.nilaiGridCache[idx];
  row[field] = val;
  const fStr = String(row.Formatif).trim();
  const sStr = String(row.Sumatif).trim();
  const hasF = fStr !== '' && !isNaN(Number(fStr));
  const hasS = sStr !== '' && !isNaN(Number(sStr));

  if (hasF || hasS) {
    const f = hasF ? Math.min(100, Math.max(0, Number(fStr))) : 0;
    const s = hasS ? Math.min(100, Math.max(0, Number(sStr))) : 0;
    const na = Math.round((0.4 * f) + (0.6 * s));
    const pred = calcPredikatClient(na);
    row.Nilai_Akhir = na;
    row.Predikat = pred;
    document.getElementById(`cell-na-${idx}`).textContent = na;
    document.getElementById(`cell-pred-${idx}`).textContent = pred;

    const descEl = document.getElementById(`cell-desc-${idx}`);
    if (descEl && !descEl.value.trim() && APP_STATE.tpCache.length > 0) {
      const autoDesc = composeDeskripsiCapaianClient(row.Nama_Siswa, na, APP_STATE.tpCache);
      descEl.value = autoDesc;
      row.Deskripsi_Capaian = autoDesc;
    }
  } else {
    row.Nilai_Akhir = '';
    row.Predikat = '';
    document.getElementById(`cell-na-${idx}`).textContent = '-';
    document.getElementById(`cell-pred-${idx}`).textContent = '-';
  }
}

function generateAllDeskripsiNilai() {
  if (APP_STATE.tpCache.length === 0) {
    showToast('Belum ada Tujuan Pembelajaran (TP) pada mapel ini. Tambahkan TP terlebih dahulu.', 'warning');
    return;
  }
  let updated = 0;
  APP_STATE.nilaiGridCache.forEach((row, idx) => {
    if (row.Nilai_Akhir !== '' && !isNaN(Number(row.Nilai_Akhir))) {
      const desc = composeDeskripsiCapaianClient(row.Nama_Siswa, Number(row.Nilai_Akhir), APP_STATE.tpCache);
      row.Deskripsi_Capaian = desc;
      const el = document.getElementById(`cell-desc-${idx}`);
      if (el) el.value = desc;
      updated++;
    }
  });
  showToast(`Deskripsi capaian otomatis disusun untuk ${updated} siswa.`, 'success');
}

async function saveAllNilaiToServer() {
  const kls = document.getElementById('nilaiSelectKelas').value;
  const mpl = document.getElementById('nilaiSelectMapel').value;
  try {
    await callServer('saveNilaiBatch', [APP_STATE.user, kls, mpl, APP_STATE.nilaiGridCache], 'Menyimpan nilai ke server...');
    APP_STATE.wkBundle = null;
    showToast('Seluruh nilai & deskripsi berhasil disimpan!', 'success');
  } catch (err) {}
}

function downloadTemplateNilai() {
  const kls = document.getElementById('nilaiSelectKelas').value;
  const mpl = document.getElementById('nilaiSelectMapel').value;
  const rows = [['NISN', 'Nama_Siswa', 'Formatif', 'Sumatif', 'Deskripsi_Capaian']];
  APP_STATE.nilaiGridCache.forEach(r => {
    rows.push([r.NISN, r.Nama_Siswa, r.Formatif, r.Sumatif, r.Deskripsi_Capaian]);
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Nilai_Mapel');
  XLSX.writeFile(wb, `Template_Nilai_${kls}_${mpl.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
}

function handleImportNilaiExcel(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const wb = XLSX.read(ev.target.result, { type: 'binary' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    if (rows.length === 0) return showToast('File Excel kosong.', 'warning');

    let matched = 0;
    rows.forEach(r => {
      const nisn = String(r.NISN || '').trim().replace(/^'+/, '');
      const idx = APP_STATE.nilaiGridCache.findIndex(x => x.NISN === nisn);
      if (idx !== -1) {
        APP_STATE.nilaiGridCache[idx].Formatif = r.Formatif;
        APP_STATE.nilaiGridCache[idx].Sumatif = r.Sumatif;
        if (String(r.Deskripsi_Capaian || '').trim() !== '') {
          APP_STATE.nilaiGridCache[idx].Deskripsi_Capaian = String(r.Deskripsi_Capaian).trim();
        }
        matched++;
      }
    });
    renderInputNilaiTable();
    APP_STATE.nilaiGridCache.forEach((row, idx) => onEditNilaiCell(idx, 'Formatif', row.Formatif));
    showToast(`${matched} nilai siswa dimuat dari Excel. Klik "Simpan Nilai" untuk menyimpan ke database.`, 'info');
  };
  reader.readAsBinaryString(file);
}

function onChangeWaliKelasSelector(newKelas) {
  APP_STATE.wkCurrentKelas = newKelas;
  document.querySelectorAll('.wk-kelas-selector').forEach(s => { s.value = newKelas; });
  APP_STATE.wkBundle = null;
  const activeView = Array.from(document.querySelectorAll('.app-view')).find(v => !v.classList.contains('hidden'));
  if (activeView) ensureWaliKelasLoaded(activeView.id.replace('view-', ''));
}

async function ensureWaliKelasLoaded(viewId) {
  const kls = APP_STATE.wkCurrentKelas;
  if (!kls) return;
  if (!APP_STATE.wkBundle || APP_STATE.wkBundle.kelas !== kls) {
    try {
      APP_STATE.wkBundle = await callServer('getWaliKelasBundle', [APP_STATE.user, kls], 'Memuat data wali kelas...');
      initEkskulDraftFromBundle();
    } catch (err) { return; }
  }
  if (viewId === 'wk-kokurikuler') renderKokurikulerView();
  else if (viewId === 'wk-ekskul') renderEkskulWaliView();
  else if (viewId === 'wk-kehadiran') renderKehadiranView();
  else if (viewId === 'wk-catatan') renderCatatanView();
  else if (viewId === 'wk-kelengkapan') renderKelengkapanRaporView();
}

function composeKokurikulerNarasi(namaSiswa, tema, dimMenonjol, dimTingkat) {
  const firstName = String(namaSiswa || '').trim();
  const temaStr = String(tema || '').trim() || 'kegiatan proyek penguatan karakter';
  const goodList = String(dimMenonjol || '').split(',').map(s => s.trim()).filter(Boolean);
  const weakList = String(dimTingkat || '').split(',').map(s => s.trim()).filter(Boolean);

  let p1 = `Dalam pelaksanaan kegiatan kokurikuler bertema "${temaStr}", ${firstName} `;
  if (goodList.length > 0) {
    const descParts = goodList.map(d => KOKU_TEMPLATES[d] || `menunjukkan perkembangan positif pada aspek ${d.toLowerCase()}.`);
    p1 += `sangat menonjol pada dimensi ${goodList.join(' dan ')}, di mana peserta didik ${descParts.join(' Selain itu, peserta didik ')}`;
  } else {
    p1 += 'berpartisipasi aktif dan menunjukkan perkembangan karakter yang positif sepanjang kegiatan berlangsung.';
  }

  if (weakList.length > 0) {
    p1 += ` Ke depannya, ${firstName} perlu terus meningkatkan konsistensi pada dimensi ${weakList.join(' dan ')} agar capaian kompetensinya semakin optimal.`;
  }
  return p1.replace(/\s+/g, ' ').trim();
}

function renderKokurikulerView() {
  const b = APP_STATE.wkBundle;
  const container = document.getElementById('kokurikulerCardsContainer');
  container.innerHTML = b.siswaList.map((s, idx) => {
    const ex = b.kokurikuler.find(k => k.NISN === s.NISN) || {};
    const goodArr = String(ex.Dimensi_Menonjol || '').split(',').map(x => x.trim()).filter(Boolean);
    const weakArr = String(ex.Dimensi_Perlu_Ditingkatkan || '').split(',').map(x => x.trim()).filter(Boolean);

    return `
      <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3" data-nisn="${escapeHtml(s.NISN)}">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div><span class="text-xs font-extrabold text-sky-700 mr-2">#${idx + 1}</span><span class="text-sm font-extrabold text-slate-800">${escapeHtml(s.Nama_Siswa)}</span> <span class="text-xs text-slate-400 font-mono">(${escapeHtml(s.NISN)})</span></div>
          <button type="button" onclick="generateSingleKokuNarasi(${idx})" class="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-[11px] font-bold self-start"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i> Susun Narasi Otomatis</button>
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1">Tema / Nama Kegiatan Kokurikuler</label>
          <input type="text" id="koku-tema-${idx}" value="${escapeHtml(ex.Tema_Kegiatan || '')}" placeholder="Contoh: Gaya Hidup Berkelanjutan / Kewirausahaan" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs">
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200">
            <p class="text-[11px] font-extrabold text-emerald-800 mb-2">Dimensi Profil Lulusan yang Menonjol:</p>
            <div class="grid grid-cols-2 gap-1.5 text-[11px]">
              ${KOKU_DIMENSI_KEYS.map(d => `<label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" class="koku-good-${idx}" value="${d}" ${goodArr.includes(d) ? 'checked' : ''}><span>${d}</span></label>`).join('')}
            </div>
          </div>
          <div class="p-3 rounded-xl bg-amber-50/60 border border-amber-200">
            <p class="text-[11px] font-extrabold text-amber-800 mb-2">Dimensi yang Perlu Ditingkatkan:</p>
            <div class="grid grid-cols-2 gap-1.5 text-[11px]">
              ${KOKU_DIMENSI_KEYS.map(d => `<label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" class="koku-weak-${idx}" value="${d}" ${weakArr.includes(d) ? 'checked' : ''}><span>${d}</span></label>`).join('')}
            </div>
          </div>
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1">Deskripsi Narasi Rapor (Dapat Diedit Manual)</label>
          <textarea id="koku-narasi-${idx}" rows="3" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs leading-relaxed">${escapeHtml(ex.Deskripsi_Narasi || '')}</textarea>
        </div>
      </div>`;
  }).join('');
}

function applyTemaToAllSiswa() {
  const tema = document.getElementById('globalTemaKokurikuler').value.trim();
  if (!tema) return showToast('Isi nama tema kegiatan terlebih dahulu.', 'warning');
  APP_STATE.wkBundle.siswaList.forEach((_, idx) => {
    const el = document.getElementById(`koku-tema-${idx}`);
    if (el) el.value = tema;
  });
  showToast('Tema diterapkan ke seluruh siswa.', 'success');
}

function generateSingleKokuNarasi(idx) {
  const s = APP_STATE.wkBundle.siswaList[idx];
  const tema = document.getElementById(`koku-tema-${idx}`).value.trim();
  const good = Array.from(document.querySelectorAll(`.koku-good-${idx}:checked`)).map(c => c.value).join(', ');
  const weak = Array.from(document.querySelectorAll(`.koku-weak-${idx}:checked`)).map(c => c.value).join(', ');
  document.getElementById(`koku-narasi-${idx}`).value = composeKokurikulerNarasi(s.Nama_Siswa, tema, good, weak);
}

function generateAllKokurikulerNarasi() {
  APP_STATE.wkBundle.siswaList.forEach((_, idx) => generateSingleKokuNarasi(idx));
  showToast('Seluruh narasi kokurikuler berhasil disusun otomatis.', 'success');
}

async function saveKokurikulerToServer() {
  const records = APP_STATE.wkBundle.siswaList.map((s, idx) => ({
    NISN: s.NISN,
    Nama_Siswa: s.Nama_Siswa,
    Tema_Kegiatan: document.getElementById(`koku-tema-${idx}`).value.trim(),
    Dimensi_Menonjol: Array.from(document.querySelectorAll(`.koku-good-${idx}:checked`)).map(c => c.value).join(', '),
    Dimensi_Perlu_Ditingkatkan: Array.from(document.querySelectorAll(`.koku-weak-${idx}:checked`)).map(c => c.value).join(', '),
    Deskripsi_Narasi: document.getElementById(`koku-narasi-${idx}`).value.trim()
  }));
  try {
    await callServer('saveKokurikulerBatch', [APP_STATE.user, APP_STATE.wkCurrentKelas, records], 'Menyimpan data kokurikuler...');
    APP_STATE.wkBundle = null;
    showToast('Penilaian kokurikuler berhasil disimpan.', 'success');
  } catch (err) {}
}

function initEkskulDraftFromBundle() {
  const b = APP_STATE.wkBundle;
  APP_STATE.wkEkskulDraft = {};
  b.siswaList.forEach(s => {
    const list = b.ekskul.filter(e => e.NISN === s.NISN).map(e => ({
      Nama_Ekskul: e.Nama_Ekskul,
      Predikat: e.Predikat || 'Baik',
      Keterangan: e.Keterangan || ''
    }));
    APP_STATE.wkEkskulDraft[s.NISN] = list;
  });
}

function renderEkskulWaliView() {
  const b = APP_STATE.wkBundle;
  const aktifEkskul = (b.masterEkskul || []).filter(e => e.Status === 'Aktif');
  const container = document.getElementById('ekskulSiswaContainer');

  container.innerHTML = b.siswaList.map((s, idx) => {
    const items = APP_STATE.wkEkskulDraft[s.NISN] || [];
    return `
      <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div class="flex items-center justify-between">
          <div><span class="text-xs font-extrabold text-sky-700 mr-2">#${idx + 1}</span><span class="text-xs font-extrabold text-slate-800">${escapeHtml(s.Nama_Siswa)}</span> <span class="text-[11px] text-slate-400 font-mono">(${escapeHtml(s.NISN)})</span></div>
          ${items.length < 4 ? `<button type="button" onclick="addEkskulRow('${escapeHtml(s.NISN)}')" class="px-3 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg text-[11px] font-bold"><i class="fa-solid fa-plus mr-1"></i> Tambah Kegiatan (${items.length}/4)</button>` : '<span class="text-[11px] font-bold text-slate-400">Maksimal 4 kegiatan</span>'}
        </div>
        ${items.length === 0 ? '<p class="text-[11px] text-slate-400 italic">Belum ada kegiatan ekstrakurikuler yang dipilih.</p>' : `
          <div class="space-y-2">
            ${items.map((it, rIdx) => `
              <div class="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div class="md:col-span-4">
                  <select onchange="updateEkskulDraft('${escapeHtml(s.NISN)}', ${rIdx}, 'Nama_Ekskul', this.value)" class="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-semibold">
                    <option value="">-- Pilih Ekstrakurikuler --</option>
                    ${aktifEkskul.map(ae => `<option value="${escapeHtml(ae.Nama_Ekskul)}" ${ae.Nama_Ekskul === it.Nama_Ekskul ? 'selected' : ''}>${escapeHtml(ae.Nama_Ekskul)}</option>`).join('')}
                  </select>
                </div>
                <div class="md:col-span-3">
                  <select onchange="updateEkskulDraft('${escapeHtml(s.NISN)}', ${rIdx}, 'Predikat', this.value)" class="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-bold">
                    <option value="Sangat Baik" ${it.Predikat === 'Sangat Baik' ? 'selected' : ''}>Sangat Baik</option>
                    <option value="Baik" ${it.Predikat === 'Baik' ? 'selected' : ''}>Baik</option>
                    <option value="Cukup" ${it.Predikat === 'Cukup' ? 'selected' : ''}>Cukup</option>
                    <option value="Kurang" ${it.Predikat === 'Kurang' ? 'selected' : ''}>Kurang</option>
                  </select>
                </div>
                <div class="md:col-span-4">
                  <input type="text" value="${escapeHtml(it.Keterangan)}" onchange="updateEkskulDraft('${escapeHtml(s.NISN)}', ${rIdx}, 'Keterangan', this.value)" placeholder="Keterangan keaktifan..." class="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs">
                </div>
                <div class="md:col-span-1 text-right">
                  <button type="button" onclick="removeEkskulRow('${escapeHtml(s.NISN)}', ${rIdx})" class="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg"><i class="fa-solid fa-trash"></i></button>
                </div>
              </div>`).join('')}
          </div>`}
      </div>`;
  }).join('');
}

function addEkskulRow(nisn) {
  if (!APP_STATE.wkEkskulDraft[nisn]) APP_STATE.wkEkskulDraft[nisn] = [];
  if (APP_STATE.wkEkskulDraft[nisn].length >= 4) return;
  APP_STATE.wkEkskulDraft[nisn].push({ Nama_Ekskul: '', Predikat: 'Baik', Keterangan: '' });
  renderEkskulWaliView();
}

function removeEkskulRow(nisn, idx) {
  APP_STATE.wkEkskulDraft[nisn].splice(idx, 1);
  renderEkskulWaliView();
}

function updateEkskulDraft(nisn, idx, field, val) {
  APP_STATE.wkEkskulDraft[nisn][idx][field] = val;
  if (field === 'Nama_Ekskul' && val && !APP_STATE.wkEkskulDraft[nisn][idx].Keterangan) {
    APP_STATE.wkEkskulDraft[nisn][idx].Keterangan = `Aktif mengikuti kegiatan ekstrakurikuler ${val} dengan baik.`;
    renderEkskulWaliView();
  }
}

async function saveEkskulToServer() {
  const flatRecords = [];
  APP_STATE.wkBundle.siswaList.forEach(s => {
    const list = APP_STATE.wkEkskulDraft[s.NISN] || [];
    list.forEach(it => {
      if (it.Nama_Ekskul) flatRecords.push({ NISN: s.NISN, Nama_Siswa: s.Nama_Siswa, Nama_Ekskul: it.Nama_Ekskul, Predikat: it.Predikat, Keterangan: it.Keterangan });
    });
  });
  try {
    await callServer('saveEkskulKelasBatch', [APP_STATE.user, APP_STATE.wkCurrentKelas, flatRecords], 'Menyimpan nilai ekstrakurikuler...');
    APP_STATE.wkBundle = null;
    showToast('Data ekstrakurikuler kelas berhasil disimpan.', 'success');
  } catch (err) {}
}

function downloadTemplateEkskul() {
  const rows = [['NISN', 'Nama_Siswa', 'Nama_Ekskul', 'Predikat', 'Keterangan']];
  APP_STATE.wkBundle.siswaList.forEach(s => {
    const list = APP_STATE.wkEkskulDraft[s.NISN] || [];
    if (list.length === 0) rows.push([s.NISN, s.Nama_Siswa, '', 'Baik', '']);
    else list.forEach(it => rows.push([s.NISN, s.Nama_Siswa, it.Nama_Ekskul, it.Predikat, it.Keterangan]));
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Ekstrakurikuler');
  XLSX.writeFile(wb, `Template_Ekskul_${APP_STATE.wkCurrentKelas}.xlsx`);
}

function handleImportEkskulExcel(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const wb = XLSX.read(ev.target.result, { type: 'binary' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    const grouped = {};
    rows.forEach(r => {
      const nisn = String(r.NISN || '').trim().replace(/^'+/, '');
      const eks = String(r.Nama_Ekskul || '').trim();
      if (!nisn || !eks) return;
      if (!grouped[nisn]) grouped[nisn] = [];
      if (grouped[nisn].length < 4) {
        grouped[nisn].push({ Nama_Ekskul: eks, Predikat: String(r.Predikat || 'Baik').trim(), Keterangan: String(r.Keterangan || '').trim() });
      }
    });
    Object.keys(grouped).forEach(nisn => { APP_STATE.wkEkskulDraft[nisn] = grouped[nisn]; });
    renderEkskulWaliView();
    showToast('Data ekstrakurikuler dimuat dari Excel. Klik "Simpan Ekstrakurikuler" untuk menyimpan.', 'info');
  };
  reader.readAsBinaryString(file);
}

function renderKehadiranView() {
  const b = APP_STATE.wkBundle;
  document.getElementById('tbodyKehadiran').innerHTML = b.siswaList.map((s, idx) => {
    const h = b.kehadiran.find(x => x.NISN === s.NISN) || { Izin: 0, Sakit: 0, Alpa: 0 };
    const tot = (Number(h.Izin) || 0) + (Number(h.Sakit) || 0) + (Number(h.Alpa) || 0);
    return `
      <tr class="hover:bg-slate-50">
        <td class="py-2.5 px-3 text-slate-500">${idx + 1}</td>
        <td class="py-2.5 px-3 font-mono text-[11px]">${escapeHtml(s.NISN)}</td>
        <td class="py-2.5 px-3 font-bold text-slate-800">${escapeHtml(s.Nama_Siswa)}</td>
        <td class="py-2.5 px-3 text-center"><input type="number" min="0" id="hdr-izin-${idx}" value="${Number(h.Izin) || 0}" oninput="recalcTotalHadir(${idx})" class="w-20 text-center px-2 py-1.5 border border-slate-300 rounded-lg font-bold"></td>
        <td class="py-2.5 px-3 text-center"><input type="number" min="0" id="hdr-sakit-${idx}" value="${Number(h.Sakit) || 0}" oninput="recalcTotalHadir(${idx})" class="w-20 text-center px-2 py-1.5 border border-slate-300 rounded-lg font-bold"></td>
        <td class="py-2.5 px-3 text-center"><input type="number" min="0" id="hdr-alpa-${idx}" value="${Number(h.Alpa) || 0}" oninput="recalcTotalHadir(${idx})" class="w-20 text-center px-2 py-1.5 border border-slate-300 rounded-lg font-bold"></td>
        <td class="py-2.5 px-3 text-center font-extrabold text-sky-700" id="hdr-tot-${idx}">${tot}</td>
      </tr>`;
  }).join('');
}

function recalcTotalHadir(idx) {
  const i = parseInt(document.getElementById(`hdr-izin-${idx}`).value, 10) || 0;
  const s = parseInt(document.getElementById(`hdr-sakit-${idx}`).value, 10) || 0;
  const a = parseInt(document.getElementById(`hdr-alpa-${idx}`).value, 10) || 0;
  document.getElementById(`hdr-tot-${idx}`).textContent = i + s + a;
}

function fillZeroKehadiran() {
  APP_STATE.wkBundle.siswaList.forEach((_, idx) => {
    document.getElementById(`hdr-izin-${idx}`).value = 0;
    document.getElementById(`hdr-sakit-${idx}`).value = 0;
    document.getElementById(`hdr-alpa-${idx}`).value = 0;
    recalcTotalHadir(idx);
  });
}

async function saveKehadiranToServer() {
  const records = APP_STATE.wkBundle.siswaList.map((s, idx) => ({
    NISN: s.NISN,
    Nama_Siswa: s.Nama_Siswa,
    Izin: document.getElementById(`hdr-izin-${idx}`).value,
    Sakit: document.getElementById(`hdr-sakit-${idx}`).value,
    Alpa: document.getElementById(`hdr-alpa-${idx}`).value
  }));
  try {
    await callServer('saveKehadiranBatch', [APP_STATE.user, APP_STATE.wkCurrentKelas, records], 'Menyimpan data kehadiran...');
    APP_STATE.wkBundle = null;
    showToast('Data kehadiran berhasil disimpan.', 'success');
  } catch (err) {}
}

function downloadTemplateKehadiran() {
  const rows = [['NISN', 'Nama_Siswa', 'Izin', 'Sakit', 'Alpa']];
  APP_STATE.wkBundle.siswaList.forEach((s, idx) => {
    rows.push([s.NISN, s.Nama_Siswa, document.getElementById(`hdr-izin-${idx}`).value, document.getElementById(`hdr-sakit-${idx}`).value, document.getElementById(`hdr-alpa-${idx}`).value]);
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Kehadiran');
  XLSX.writeFile(wb, `Template_Kehadiran_${APP_STATE.wkCurrentKelas}.xlsx`);
}

function handleImportKehadiranExcel(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const wb = XLSX.read(ev.target.result, { type: 'binary' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: 0 });
    rows.forEach(r => {
      const nisn = String(r.NISN || '').trim().replace(/^'+/, '');
      const idx = APP_STATE.wkBundle.siswaList.findIndex(s => s.NISN === nisn);
      if (idx !== -1) {
        document.getElementById(`hdr-izin-${idx}`).value = parseInt(r.Izin, 10) || 0;
        document.getElementById(`hdr-sakit-${idx}`).value = parseInt(r.Sakit, 10) || 0;
        document.getElementById(`hdr-alpa-${idx}`).value = parseInt(r.Alpa, 10) || 0;
        recalcTotalHadir(idx);
      }
    });
    showToast('Data kehadiran dimuat dari Excel. Klik "Simpan Kehadiran" untuk menyimpan.', 'info');
  };
  reader.readAsBinaryString(file);
}

function renderCatatanView() {
  const b = APP_STATE.wkBundle;
  document.getElementById('catatanListContainer').innerHTML = b.siswaList.map((s, idx) => {
    const c = b.catatan.find(x => x.NISN === s.NISN) || { Catatan: '' };
    return `
      <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2">
        <div class="flex items-center justify-between">
          <div><span class="text-xs font-extrabold text-sky-700 mr-2">#${idx + 1}</span><span class="text-xs font-extrabold text-slate-800">${escapeHtml(s.Nama_Siswa)}</span></div>
          <button type="button" onclick="generateSingleSaranCatatan(${idx})" class="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-[11px] font-bold"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i> Saran Otomatis</button>
        </div>
        <textarea id="cat-text-${idx}" rows="2" placeholder="Tuliskan catatan perkembangan akademik, sikap, dan motivasi..." class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs">${escapeHtml(c.Catatan)}</textarea>
      </div>`;
  }).join('');
}

function generateSingleSaranCatatan(idx) {
  const b = APP_STATE.wkBundle;
  const s = b.siswaList[idx];
  const nilaiSiswa = b.nilaiRapor.filter(n => n.NISN === s.NISN && n.Nilai_Akhir !== '').map(n => Number(n.Nilai_Akhir));
  const avg = nilaiSiswa.length > 0 ? (nilaiSiswa.reduce((a, v) => a + v, 0) / nilaiSiswa.length) : 80;
  const hadir = b.kehadiran.find(h => h.NISN === s.NISN) || { Alpa: 0 };
  const alpa = Number(hadir.Alpa) || 0;

  let saran = '';
  if (avg >= 88 && alpa === 0) saran = `Prestasi belajar ${s.Nama_Siswa} sangat membanggakan dan disiplin kehadiran sangat baik. Pertahankan semangat belajar dan terus kembangkan potensimu!`;
  else if (avg >= 78 && alpa <= 1) saran = `Perkembangan belajar ${s.Nama_Siswa} sudah baik. Tingkatkan terus ketekunan dan keaktifan dalam setiap mata pelajaran di semester berikutnya.`;
  else saran = `${s.Nama_Siswa} perlu meningkatkan kedisiplinan belajar dan kehadiran di sekolah agar capaian kompetensi pada semester mendatang dapat lebih maksimal.`;

  document.getElementById(`cat-text-${idx}`).value = saran;
}

function generateAllSaranCatatan() {
  APP_STATE.wkBundle.siswaList.forEach((_, idx) => generateSingleSaranCatatan(idx));
  showToast('Saran catatan wali kelas berhasil dibuat.', 'success');
}

async function saveCatatanToServer() {
  const records = APP_STATE.wkBundle.siswaList.map((s, idx) => ({
    NISN: s.NISN,
    Nama_Siswa: s.Nama_Siswa,
    Catatan: document.getElementById(`cat-text-${idx}`).value.trim()
  }));
  try {
    await callServer('saveCatatanBatch', [APP_STATE.user, APP_STATE.wkCurrentKelas, records], 'Menyimpan catatan wali kelas...');
    APP_STATE.wkBundle = null;
    showToast('Catatan wali kelas berhasil disimpan.', 'success');
  } catch (err) {}
}

function renderKelengkapanRaporView() {
  const b = APP_STATE.wkBundle;
  const totalMapel = b.mapelAktif.length;

  const missingMapels = [];
  b.mapelAktif.forEach(m => {
    const filled = b.nilaiRapor.filter(n => n.Mapel === m.Nama_Mapel && n.Nilai_Akhir !== '').length;
    if (filled < b.siswaList.length) missingMapels.push(`${m.Nama_Mapel} (${filled}/${b.siswaList.length})`);
  });

  document.getElementById('rekapMapelBelumLengkapBox').innerHTML = missingMapels.length === 0
    ? '<p class="text-xs font-bold text-emerald-700"><i class="fa-solid fa-circle-check mr-1.5"></i> Seluruh nilai mata pelajaran pada kelas ini sudah terisi 100%!</p>'
    : `<p class="text-xs font-bold text-amber-800 mb-1"><i class="fa-solid fa-triangle-exclamation mr-1.5"></i> Mata Pelajaran yang Belum Lengkap Nilainya:</p><p class="text-xs text-slate-600">${escapeHtml(missingMapels.join(' • '))}</p>`;

  const idMap = {};
  b.identitas.forEach(i => { idMap[i.NISN] = i; });

  document.getElementById('tbodyKelengkapanRapor').innerHTML = b.siswaList.map((s, idx) => {
    const stId = checkIdentitasPokokStatus(Object.assign({}, s, { identitas: idMap[s.NISN] || {} }));
    const jmlNilai = b.nilaiRapor.filter(n => n.NISN === s.NISN && n.Nilai_Akhir !== '').length;
    const hasKoku = b.kokurikuler.some(k => k.NISN === s.NISN && k.Deskripsi_Narasi);
    const jmlEks = b.ekskul.filter(e => e.NISN === s.NISN).length;
    const hasHadir = b.kehadiran.some(h => h.NISN === s.NISN);
    const hasCat = b.catatan.some(c => c.NISN === s.NISN && c.Catatan);

    const badge = (ok, label) => ok
      ? `<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">${label || '✓'}</span>`
      : `<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px]">${label || 'Belum'}</span>`;

    return `
      <tr class="hover:bg-slate-50">
        <td class="py-2.5 px-3 text-slate-500">${idx + 1}</td>
        <td class="py-2.5 px-3 font-bold text-slate-800">${escapeHtml(s.Nama_Siswa)}</td>
        <td class="py-2.5 px-3 text-center">${badge(stId.isComplete, stId.isComplete ? 'Lengkap' : 'Kurang')}</td>
        <td class="py-2.5 px-3 text-center">${badge(jmlNilai === totalMapel, `${jmlNilai}/${totalMapel}`)}</td>
        <td class="py-2.5 px-3 text-center">${badge(hasKoku, hasKoku ? 'Ada' : 'Kosong')}</td>
        <td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">${jmlEks} Ekskul</span></td>
        <td class="py-2.5 px-3 text-center">${badge(hasHadir, hasHadir ? 'Ada' : 'Belum')}</td>
        <td class="py-2.5 px-3 text-center">${badge(hasCat, hasCat ? 'Ada' : 'Kosong')}</td>
      </tr>`;
  }).join('');
}

async function onChangeCoverKelas() {
  const kls = document.getElementById('coverSelectKelas').value;
  if (!kls) return;
  try {
    const list = await callServer('getSiswaByKelas', [APP_STATE.user, kls], 'Memuat daftar siswa...');
    document.getElementById('coverSelectSiswa').innerHTML = list.map(s => `<option value="${escapeHtml(s.NISN)}">${escapeHtml(s.Nama_Siswa)} (${escapeHtml(s.NISN)})</option>`).join('');
  } catch (err) {}
}

function toggleCoverSiswaDropdown() {
  const mode = document.getElementById('coverModeCetak').value;
  document.getElementById('coverSiswaWrapper').classList.toggle('hidden', mode === 'kelas');
}

async function previewCoverRapor() {
  const kls = document.getElementById('coverSelectKelas').value;
  const mode = document.getElementById('coverModeCetak').value;
  const nisn = document.getElementById('coverSelectSiswa').value;
  const paper = document.getElementById('coverPaperSize').value;
  if (!kls) return;

  try {
    const bundle = mode === 'siswa'
      ? await callServer('getRaporSiswa', [APP_STATE.user, kls, nisn], 'Menyiapkan cover rapor...')
      : await callServer('getRaporKelas', [APP_STATE.user, kls], 'Menyiapkan cover rapor satu kelas...');

    setPrintPageStyle(paper, 'portrait');
    const html = bundle.siswaData.map(s => buildCoverRaporHtml(s, bundle.config)).join('');
    const prev = document.getElementById('coverPreviewWrapper');
    prev.innerHTML = html;
    prev.classList.remove('hidden');
    document.getElementById('printAreaContainer').innerHTML = html;
  } catch (err) {}
}

async function onChangeRaporKelas() {
  const kls = document.getElementById('raporSelectKelas').value;
  if (!kls) return;
  try {
    const list = await callServer('getSiswaByKelas', [APP_STATE.user, kls], 'Memuat daftar siswa...');
    document.getElementById('raporSelectSiswa').innerHTML = list.map(s => `<option value="${escapeHtml(s.NISN)}">${escapeHtml(s.Nama_Siswa)} (${escapeHtml(s.NISN)})</option>`).join('');
  } catch (err) {}
}

function toggleRaporSiswaDropdown() {
  const mode = document.getElementById('raporModeCetak').value;
  document.getElementById('raporSiswaWrapper').classList.toggle('hidden', mode === 'kelas');
}

function onChangeRaporOption() {
  const val = document.querySelector('input[name="raporPrintOption"]:checked').value;
  document.getElementById('raporCustomCheckboxes').classList.toggle('hidden', val !== 'custom');
  saveRaporOptionPref();
}

function saveRaporOptionPref() {
  const val = document.querySelector('input[name="raporPrintOption"]:checked').value;
  const pref = {
    mode: val,
    cover: document.getElementById('chkPrintCover').checked,
    identitas: document.getElementById('chkPrintIdentitas').checked,
    nilai: document.getElementById('chkPrintNilai').checked
  };
  localStorage.setItem('erapor_print_pref', JSON.stringify(pref));
}

function restoreRaporOptionPref() {
  try {
    const raw = localStorage.getItem('erapor_print_pref');
    if (!raw) return;
    const pref = JSON.parse(raw);
    document.querySelectorAll('input[name="raporPrintOption"]').forEach(r => { r.checked = r.value === pref.mode; });
    document.getElementById('chkPrintCover').checked = !!pref.cover;
    document.getElementById('chkPrintIdentitas').checked = !!pref.identitas;
    document.getElementById('chkPrintNilai').checked = !!pref.nilai;
    document.getElementById('raporCustomCheckboxes').classList.toggle('hidden', pref.mode !== 'custom');
  } catch (e) {}
}

function getSelectedRaporSections() {
  const mode = document.querySelector('input[name="raporPrintOption"]:checked').value;
  if (mode === 'nilai') return { cover: false, identitas: false, nilai: true };
  if (mode === 'lengkap') return { cover: true, identitas: true, nilai: true };
  return {
    cover: document.getElementById('chkPrintCover').checked,
    identitas: document.getElementById('chkPrintIdentitas').checked,
    nilai: document.getElementById('chkPrintNilai').checked
  };
}

async function previewRaporDocument() {
  const sections = getSelectedRaporSections();
  if (!sections.cover && !sections.identitas && !sections.nilai) {
    showToast('Pilih minimal satu bagian rapor yang akan dicetak.', 'warning');
    return;
  }
  const kls = document.getElementById('raporSelectKelas').value;
  const mode = document.getElementById('raporModeCetak').value;
  const nisn = document.getElementById('raporSelectSiswa').value;
  const paper = document.getElementById('raporPaperSize').value;

  try {
    const bundle = mode === 'siswa'
      ? await callServer('getRaporSiswa', [APP_STATE.user, kls, nisn], 'Menyusun lembar rapor...')
      : await callServer('getRaporKelas', [APP_STATE.user, kls], 'Menyusun lembar rapor satu kelas...');

    if (sections.identitas) {
      const incompleteNames = bundle.siswaData.filter(s => !checkIdentitasPokokStatus(s).isComplete).map(s => s.Nama_Siswa);
      if (incompleteNames.length > 0) {
        showConfirmDialog(
          'Peringatan Data Identitas Belum Lengkap',
          `Terdapat ${incompleteNames.length} siswa yang data identitas pokoknya belum lengkap (${incompleteNames.slice(0, 3).join(', ')}...). Halaman identitas akan mencetak tanda strip (-). Lanjutkan?`,
          () => renderRaporToDom(bundle, sections, paper),
          'Tetap Lanjutkan'
        );
        return;
      }
    }
    renderRaporToDom(bundle, sections, paper);
  } catch (err) {}
}

function renderRaporToDom(bundle, sections, paper) {
  setPrintPageStyle(paper, 'portrait');
  const fullHtml = bundle.siswaData.map(s => {
    let part = '';
    if (sections.cover) part += buildCoverRaporHtml(s, bundle.config);
    if (sections.identitas) part += buildIdentitasRaporHtml(s, bundle.config);
    if (sections.nilai) part += buildNilaiRaporHtml(s, bundle);
    return part;
  }).join('');

  const prev = document.getElementById('raporPreviewWrapper');
  prev.innerHTML = fullHtml;
  prev.classList.remove('hidden');
  document.getElementById('printAreaContainer').innerHTML = fullHtml;
}

function setPrintPageStyle(paperSize, orientation) {
  const sizeCss = paperSize === 'F4' ? `215mm 330mm` : `A4 ${orientation}`;
  document.getElementById('dynamicPageStyle').textContent = `@page { size: ${sizeCss}; margin: 10mm 12mm 10mm 12mm; }`;
}

function executePrintDocument() {
  const pa = document.getElementById('printAreaContainer');
  if (!pa.innerHTML.trim()) {
    showToast('Klik "Tampilkan Pratinjau" terlebih dahulu sebelum mencetak.', 'warning');
    return;
  }
  window.print();
}

async function loadLeggerData() {
  const kls = document.getElementById('leggerSelectKelas').value;
  if (!kls) return;
  try {
    APP_STATE.leggerBundleCache = await callServer('getLeggerKelas', [APP_STATE.user, kls], 'Memuat legger nilai kelas...');
    renderLeggerView();
  } catch (err) {}
}

function renderLeggerView() {
  const b = APP_STATE.leggerBundleCache;
  if (!b) return;
  const sortBy = document.getElementById('leggerSortBy').value;
  const html = buildLeggerHtml(b, sortBy);
  document.getElementById('leggerPreviewWrapper').innerHTML = html;
  document.getElementById('printAreaContainer').innerHTML = html;
}

function printLeggerDocument() {
  const paper = document.getElementById('leggerPaperSize').value;
  const sizeCss = paper === 'F4' ? '330mm 215mm' : 'A4 landscape';
  document.getElementById('dynamicPageStyle').textContent = `@page { size: ${sizeCss}; margin: 8mm 10mm 8mm 10mm; }`;
  renderLeggerView();
  window.print();
}

function exportLeggerExcel() {
  const b = APP_STATE.leggerBundleCache;
  if (!b) return;
  const headers = ['No', 'NISN', 'NIS', 'Nama Siswa', 'L/P', ...b.mapelAktif.map(m => m.Singkatan), 'Jumlah', 'Rata-rata', 'Peringkat', 'Izin', 'Sakit', 'Alpa'];
  const rows = [headers];
  b.siswaData.forEach((s, idx) => {
    const scores = b.mapelAktif.map(m => {
      const f = s.nilaiPerMapel.find(x => x.Nama_Mapel === m.Nama_Mapel);
      return f && f.Nilai_Akhir !== null ? f.Nilai_Akhir : '';
    });
    rows.push([idx + 1, s.NISN, s.NIS, s.Nama_Siswa, s.JK, ...scores, s.jumlahNilai, s.rataRata, s.peringkat || '-', s.kehadiran.Izin, s.kehadiran.Sakit, s.kehadiran.Alpa]);
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), `Legger_${b.kelas}`);
  XLSX.writeFile(wb, `Legger_Nilai_${b.kelas}_${b.config.Semester_Aktif}.xlsx`);
}

/* ============================================================================
 * TEMPLATE CETAK RAPOR (COVER, IDENTITAS, HALAMAN NILAI, LEGGER)
 * ============================================================================ */

function formatTanggalIndo(tglStr) {
  if (!tglStr) return '-';
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const m = String(tglStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const bIdx = parseInt(m[2], 10) - 1;
    return `${parseInt(m[3], 10)} ${bulan[bIdx] || m[2]} ${m[1]}`;
  }
  return tglStr;
}

function buildKopSekolahHtml(config) {
  const logoKiri = config.Logo_Kiri ? `<img src="${config.Logo_Kiri}" style="height:64px; width:auto; object-fit:contain;">` : '';
  const logoKanan = config.Logo_Kanan ? `<img src="${config.Logo_Kanan}" style="height:64px; width:auto; object-fit:contain;">` : '';
  return `
    <table style="width:100%; border-collapse:collapse; border-bottom:3px double #000; padding-bottom:6px; margin-bottom:10px;">
      <tr>
        <td style="width:75px; text-align:left; vertical-align:middle;">${logoKiri}</td>
        <td style="text-align:center; vertical-align:middle;">
          <div style="font-size:13pt; font-weight:bold; text-transform:uppercase;">${escapeHtml(config.Nama_Sekolah || 'NAMA SEKOLAH')}</div>
          <div style="font-size:9.5pt;">NPSN: ${escapeHtml(config.NPSN || '-')} | Jenjang: ${escapeHtml(config.Jenjang || 'SMK')}</div>
          <div style="font-size:9.5pt;">${escapeHtml(config.Alamat || '')}</div>
        </td>
        <td style="width:75px; text-align:right; vertical-align:middle;">${logoKanan}</td>
      </tr>
    </table>`;
}

function buildCoverRaporHtml(siswa, config) {
  const logoCover = config.Logo_Cover || config.Logo_Kanan || config.Logo_Kiri || '';
  const logoHtml = logoCover
    ? `<img src="${logoCover}" style="width:42mm; height:42mm; object-fit:contain; margin:0 auto;">`
    : `<div style="width:40mm; height:40mm; border:2px dashed #64748b; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto; font-size:10pt; color:#64748b;">LOGO SEKOLAH</div>`;

  return `
    <div class="rapor-sheet page-break-item">
      <div class="cover-frame">
        <div style="margin-top:8mm;">
          <div style="font-size:16pt; font-weight:bold; letter-spacing:0.5px; text-transform:uppercase;">${escapeHtml(config.Judul_Cover || 'LAPORAN HASIL BELAJAR (RAPOR) PESERTA DIDIK')}</div>
          <div style="font-size:13pt; font-weight:bold; margin-top:4mm; text-transform:uppercase;">${escapeHtml(config.Subjudul_Cover || '')}</div>
        </div>
        <div style="margin:10mm 0;">${logoHtml}</div>
        <div style="width:82%; margin:0 auto;">
          <div style="font-size:11pt; font-weight:bold; margin-bottom:2mm;">NAMA PESERTA DIDIK :</div>
          <div style="border:1.5px solid #000; padding:8px 12px; font-size:13pt; font-weight:bold; text-transform:uppercase; margin-bottom:7mm;">${escapeHtml(siswa.Nama_Siswa)}</div>
          <div style="font-size:11pt; font-weight:bold; margin-bottom:2mm;">NISN / NIS :</div>
          <div style="border:1.5px solid #000; padding:7px 12px; font-size:12pt; font-weight:bold;">${escapeHtml(siswa.NISN || '-')} / ${escapeHtml(siswa.NIS || '-')}</div>
        </div>
        <div style="margin-bottom:4mm;">
          <div style="font-size:13pt; font-weight:bold; text-transform:uppercase;">${escapeHtml(config.Nama_Sekolah || '')}</div>
          <div style="font-size:10pt; margin-top:1mm;">${escapeHtml(config.Alamat || '')}</div>
          <div style="font-size:11.5pt; font-weight:bold; margin-top:6mm; text-transform:uppercase; white-space:pre-line;">${escapeHtml(config.Instansi_Cover || 'KEMENTERIAN PENDIDIKAN DASAR DAN MENENGAH\nREPUBLIK INDONESIA')}</div>
        </div>
      </div>
    </div>`;
}

function buildIdentitasRaporHtml(siswa, config) {
  const id = siswa.identitas || {};
  const val = (k) => escapeHtml((id[k] !== undefined && String(id[k]).trim() !== '') ? id[k] : (siswa[k] || '-'));
  const jkLabel = (siswa.JK === 'L' || id.JK === 'L') ? 'Laki-laki' : ((siswa.JK === 'P' || id.JK === 'P') ? 'Perempuan' : '-');
  const ttl = `${val('Tempat_Lahir')}, ${formatTanggalIndo(id.Tanggal_Lahir)}`;

  return `
    <div class="rapor-sheet page-break-item">
      ${buildKopSekolahHtml(config)}
      <div style="text-align:center; font-size:12.5pt; font-weight:bold; margin:8px 0 14px 0; text-transform:uppercase;">KETERANGAN TENTANG DIRI PESERTA DIDIK</div>
      <table class="tbl-identitas">
        <tr><td style="width:26px;">1.</td><td style="width:210px;">Nama Peserta Didik (Lengkap)</td><td style="width:14px;">:</td><td style="font-weight:bold;">${escapeHtml(siswa.Nama_Siswa)}</td></tr>
        <tr><td>2.</td><td>Nomor Induk / NISN</td><td>:</td><td>${escapeHtml(siswa.NIS || '-')} / ${escapeHtml(siswa.NISN || '-')}</td></tr>
        <tr><td>3.</td><td>Tempat, Tanggal Lahir</td><td>:</td><td>${ttl}</td></tr>
        <tr><td>4.</td><td>Jenis Kelamin</td><td>:</td><td>${jkLabel}</td></tr>
        <tr><td>5.</td><td>Agama</td><td>:</td><td>${val('Agama')}</td></tr>
        <tr><td>6.</td><td>Status dalam Keluarga</td><td>:</td><td>${val('Status_Dalam_Keluarga')}</td></tr>
        <tr><td>7.</td><td>Anak ke-</td><td>:</td><td>${val('Anak_Ke')}</td></tr>
        <tr><td>8.</td><td>Alamat Peserta Didik</td><td>:</td><td>${val('Alamat_Siswa')}</td></tr>
        <tr><td>9.</td><td>Nomor Telepon Rumah / HP</td><td>:</td><td>${val('No_Telp_Siswa')}</td></tr>
        <tr><td>10.</td><td>Sekolah Asal</td><td>:</td><td>${val('Sekolah_Asal')}</td></tr>
        <tr><td>11.</td><td>Diterima di Sekolah Ini</td><td></td><td></td></tr>
        <tr><td></td><td style="padding-left:14px;">a. Di Kelas</td><td>:</td><td>${val('Diterima_Di_Kelas')}</td></tr>
        <tr><td></td><td style="padding-left:14px;">b. Pada Tanggal</td><td>:</td><td>${formatTanggalIndo(id.Tanggal_Diterima)}</td></tr>
        <tr><td>12.</td><td>Nama Orang Tua</td><td></td><td></td></tr>
        <tr><td></td><td style="padding-left:14px;">a. Ayah</td><td>:</td><td>${val('Nama_Ayah')}</td></tr>
        <tr><td></td><td style="padding-left:14px;">b. Ibu</td><td>:</td><td>${val('Nama_Ibu')}</td></tr>
        <tr><td>13.</td><td>Alamat Orang Tua</td><td>:</td><td>${val('Alamat_Orang_Tua')}</td></tr>
        <tr><td></td><td style="padding-left:14px;">Nomor Telepon Rumah / HP</td><td>:</td><td>${val('No_Telp_Orang_Tua')}</td></tr>
        <tr><td>14.</td><td>Pekerjaan Orang Tua</td><td></td><td></td></tr>
        <tr><td></td><td style="padding-left:14px;">a. Ayah</td><td>:</td><td>${val('Pekerjaan_Ayah')}</td></tr>
        <tr><td></td><td style="padding-left:14px;">b. Ibu</td><td>:</td><td>${val('Pekerjaan_Ibu')}</td></tr>
        <tr><td>15.</td><td>Nama Wali Peserta Didik</td><td>:</td><td>${val('Nama_Wali')}</td></tr>
        <tr><td>16.</td><td>Alamat Wali Peserta Didik</td><td>:</td><td>${val('Alamat_Wali')}</td></tr>
        <tr><td></td><td style="padding-left:14px;">Nomor Telepon Rumah / HP</td><td>:</td><td>${val('No_Telp_Wali')}</td></tr>
        <tr><td>17.</td><td>Pekerjaan Wali Peserta Didik</td><td>:</td><td>${val('Pekerjaan_Wali')}</td></tr>
      </table>

      <table style="width:100%; margin-top:24px; border-collapse:collapse; font-size:10.5pt;">
        <tr>
          <td style="width:35%; text-align:center; vertical-align:middle;"><div class="foto-3x4" style="margin:0 auto;">Pas Foto<br>3 x 4</div></td>
          <td style="width:20%;"></td>
          <td style="width:45%; vertical-align:top;">
            <div>${escapeHtml(config.Kota_Rapor || 'Kota')}, ${escapeHtml(formatTanggalIndo(id.Tanggal_Diterima) !== '-' ? formatTanggalIndo(id.Tanggal_Diterima) : (config.Tanggal_Rapor || ''))}</div>
            <div>Kepala Sekolah,</div>
            <div style="height:56px;"></div>
            <div style="font-weight:bold; text-decoration:underline;">${escapeHtml(config.Kepala_Sekolah || '')}</div>
            <div>NIP. ${escapeHtml(config.NIP_Kepsek || '-')}</div>
          </td>
        </tr>
      </table>
    </div>`;
}

function buildNilaiRaporHtml(siswa, bundle) {
  const config = bundle.config;
  const wali = bundle.waliKelas || { Nama_Lengkap: '....................', NIP: '-' };
  const showRank = String(config.Tampilkan_Peringkat_Di_Rapor || 'Tidak') === 'Ya';

  const kelompokDefs = [
    { key: 'Umum', label: 'A. Kelompok Mata Pelajaran Umum' },
    { key: 'Kejuruan', label: 'B. Kelompok Mata Pelajaran Kejuruan' },
    { key: 'Pilihan', label: 'C. Kelompok Mata Pelajaran Pilihan' }
  ];

  let mapelRowsHtml = '';
  kelompokDefs.forEach(grp => {
    const items = (siswa.nilaiPerMapel || []).filter(m => (m.Kelompok_Mapel || 'Umum') === grp.key);
    if (items.length === 0) return;
    mapelRowsHtml += `<tr><td colspan="4" style="font-weight:bold; background:#f8fafc;">${grp.label}</td></tr>`;
    items.forEach((m, idx) => {
      const nilaiStr = m.Nilai_Akhir !== null && m.Nilai_Akhir !== undefined ? m.Nilai_Akhir : '-';
      mapelRowsHtml += `
        <tr>
          <td style="text-align:center; width:30px;">${idx + 1}</td>
          <td style="width:34%;">${escapeHtml(m.Nama_Mapel)}</td>
          <td style="text-align:center; font-weight:bold; width:55px;">${nilaiStr}</td>
          <td style="text-align:justify; font-size:9.5pt;">${escapeHtml(m.Deskripsi_Capaian || '-')}</td>
        </tr>`;
    });
  });

  if (showRank && siswa.peringkat) {
    mapelRowsHtml += `
      <tr style="background:#f8fafc; font-weight:bold;">
        <td colspan="2" style="text-align:right;">Jumlah Nilai / Rata-rata</td>
        <td style="text-align:center;">${siswa.jumlahNilai} / ${siswa.rataRata}</td>
        <td>Peringkat Kelas: Ke-${siswa.peringkat} dari ${bundle.totalEligiblePeringkat} siswa</td>
      </tr>`;
  }

  const ekskulList = siswa.ekskul || [];
  let ekskulRowsHtml = '';
  if (ekskulList.length === 0) {
    ekskulRowsHtml = `<tr><td style="text-align:center;">1</td><td>-</td><td style="text-align:center;">-</td><td>-</td></tr>`;
  } else {
    ekskulList.forEach((e, idx) => {
      ekskulRowsHtml += `
        <tr>
          <td style="text-align:center; width:30px;">${idx + 1}</td>
          <td style="width:30%;">${escapeHtml(e.Nama_Ekskul)}</td>
          <td style="text-align:center; width:90px;">${escapeHtml(e.Predikat || '-')}</td>
          <td>${escapeHtml(e.Keterangan || '-')}</td>
        </tr>`;
    });
  }

  const kokuText = (siswa.kokurikuler && siswa.kokurikuler.Deskripsi_Narasi)
    ? siswa.kokurikuler.Deskripsi_Narasi
    : 'Peserta didik mengikuti kegiatan kokurikuler dengan baik.';
  const hadir = siswa.kehadiran || { Sakit: 0, Izin: 0, Alpa: 0 };

  return `
    <div class="rapor-sheet page-break-item">
      ${buildKopSekolahHtml(config)}
      <div style="text-align:center; font-size:12pt; font-weight:bold; margin:4px 0 10px 0; text-transform:uppercase;">LAPORAN HASIL BELAJAR (RAPOR)</div>

      <table style="width:100%; border-collapse:collapse; font-size:10pt; margin-bottom:10px;">
        <tr>
          <td style="width:130px; padding:2px 0;">Nama Peserta Didik</td><td style="width:10px;">:</td><td style="font-weight:bold; width:42%;">${escapeHtml(siswa.Nama_Siswa)}</td>
          <td style="width:115px;">Kelas</td><td style="width:10px;">:</td><td style="font-weight:bold;">${escapeHtml(siswa.Kelas)}</td>
        </tr>
        <tr>
          <td style="padding:2px 0;">NISN / NIS</td><td>:</td><td>${escapeHtml(siswa.NISN || '-')} / ${escapeHtml(siswa.NIS || '-')}</td>
          <td>Fase</td><td>:</td><td>${escapeHtml(siswa.Kelas && siswa.Kelas.startsWith('X-') ? 'E' : 'F')}</td>
        </tr>
        <tr>
          <td style="padding:2px 0;">Nama Sekolah</td><td>:</td><td>${escapeHtml(config.Nama_Sekolah || '')}</td>
          <td>Semester</td><td>:</td><td>${escapeHtml(config.Semester_Aktif || '')}</td>
        </tr>
        <tr>
          <td style="padding:2px 0;">Alamat Sekolah</td><td>:</td><td>${escapeHtml(config.Alamat || '')}</td>
          <td>Tahun Ajaran</td><td>:</td><td>${escapeHtml(config.Tahun_Ajaran_Aktif || '')}</td>
        </tr>
      </table>

      <div style="font-weight:bold; font-size:10.5pt; margin-top:4px;">1. Nilai Akademik</div>
      <table class="tbl-rapor">
        <thead><tr><th>No</th><th>Mata Pelajaran</th><th>Nilai Akhir</th><th>Capaian Kompetensi</th></tr></thead>
        <tbody>${mapelRowsHtml}</tbody>
      </table>

      <div style="font-weight:bold; font-size:10.5pt; margin-top:8px;">2. Kokurikuler</div>
      <div class="box-narasi">
        ${siswa.kokurikuler && siswa.kokurikuler.Tema_Kegiatan ? `<div style="font-weight:bold; margin-bottom:3px;">Tema: ${escapeHtml(siswa.kokurikuler.Tema_Kegiatan)}</div>` : ''}
        <div>${escapeHtml(kokuText)}</div>
      </div>

      <div style="font-weight:bold; font-size:10.5pt; margin-top:8px;">3. Ekstrakurikuler</div>
      <table class="tbl-rapor">
        <thead><tr><th>No</th><th>Kegiatan Ekstrakurikuler</th><th>Predikat</th><th>Keterangan</th></tr></thead>
        <tbody>${ekskulRowsHtml}</tbody>
      </table>

      <table style="width:100%; border-collapse:collapse; margin-top:6px;">
        <tr>
          <td style="width:42%; vertical-align:top; padding-right:10px;">
            <div style="font-weight:bold; font-size:10.5pt; margin-bottom:4px;">4. Ketidakhadiran</div>
            <table class="tbl-rapor" style="margin-top:0;">
              <tr><td style="width:60%;">Sakit</td><td style="text-align:center;">${hadir.Sakit} hari</td></tr>
              <tr><td>Izin</td><td style="text-align:center;">${hadir.Izin} hari</td></tr>
              <tr><td>Tanpa Keterangan</td><td style="text-align:center;">${hadir.Alpa} hari</td></tr>
            </table>
          </td>
          <td style="width:58%; vertical-align:top;">
            <div style="font-weight:bold; font-size:10.5pt; margin-bottom:4px;">5. Catatan Wali Kelas</div>
            <div class="box-narasi" style="margin-top:0; min-height:66px;">${escapeHtml(siswa.catatan || 'Tetap semangat belajar dan tingkatkan prestasi.')}</div>
          </td>
        </tr>
      </table>

      <table style="width:100%; border-collapse:collapse; margin-top:16px; font-size:10pt; page-break-inside:avoid;">
        <tr>
          <td style="width:34%; vertical-align:top;"><div>Mengetahui,</div><div>Orang Tua / Wali,</div><div style="height:54px;"></div><div>........................................</div></td>
          <td style="width:32%;"></td>
          <td style="width:34%; vertical-align:top;">
            <div>${escapeHtml(config.Kota_Rapor || 'Kota')}, ${escapeHtml(config.Tanggal_Rapor || '')}</div>
            <div>Wali Kelas,</div><div style="height:54px;"></div>
            <div style="font-weight:bold; text-decoration:underline;">${escapeHtml(wali.Nama_Lengkap)}</div>
            <div>NIP. ${escapeHtml(wali.NIP || '-')}</div>
          </td>
        </tr>
        <tr>
          <td colspan="3" style="text-align:center; padding-top:14px;">
            <div>Mengetahui,</div><div>Kepala Sekolah,</div><div style="height:54px;"></div>
            <div style="font-weight:bold; text-decoration:underline;">${escapeHtml(config.Kepala_Sekolah || '')}</div>
            <div>NIP. ${escapeHtml(config.NIP_Kepsek || '-')}</div>
          </td>
        </tr>
      </table>
    </div>`;
}

function buildLeggerHtml(bundle, sortBy) {
  const config = bundle.config;
  const mapels = bundle.mapelAktif || [];
  let list = [...(bundle.siswaData || [])];
  if (sortBy === 'peringkat') {
    list.sort((a, b) => {
      if (a.peringkat === null && b.peringkat === null) return a.noAbsen - b.noAbsen;
      if (a.peringkat === null) return 1;
      if (b.peringkat === null) return -1;
      return a.peringkat - b.peringkat;
    });
  } else {
    list.sort((a, b) => a.noAbsen - b.noAbsen);
  }

  const thMapels = mapels.map(m => `<th class="vertical-th" title="${escapeHtml(m.Nama_Mapel)}">${escapeHtml(m.Singkatan)}</th>`).join('');
  const bodyRows = list.map((s, idx) => {
    const tdScores = mapels.map(m => {
      const f = s.nilaiPerMapel.find(x => x.Nama_Mapel === m.Nama_Mapel);
      const v = f && f.Nilai_Akhir !== null ? f.Nilai_Akhir : '-';
      return `<td>${v}</td>`;
    }).join('');
    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(s.NISN)}</td>
        <td style="text-align:left; font-weight:bold; white-space:nowrap;">${escapeHtml(s.Nama_Siswa)}</td>
        <td>${escapeHtml(s.JK)}</td>
        ${tdScores}
        <td style="font-weight:bold;">${s.jumlahNilai}</td>
        <td style="font-weight:bold;">${s.rataRata}</td>
        <td style="font-weight:bold; background:#f8fafc;">${s.peringkat !== null ? s.peringkat : '-'}</td>
        <td>${s.kehadiran.Izin}</td>
        <td>${s.kehadiran.Sakit}</td>
        <td>${s.kehadiran.Alpa}</td>
      </tr>`;
  }).join('');

  const stats = bundle.mapelStats || {};
  const rowAvg = mapels.map(m => `<td>${(stats[m.Nama_Mapel] || {}).rataRata || '-'}</td>`).join('');
  const rowMax = mapels.map(m => `<td>${(stats[m.Nama_Mapel] || {}).tertinggi || '-'}</td>`).join('');
  const rowMin = mapels.map(m => `<td>${(stats[m.Nama_Mapel] || {}).terendah || '-'}</td>`).join('');

  return `
    <div class="legger-sheet">
      <div style="text-align:center; margin-bottom:8px;">
        <div style="font-size:12pt; font-weight:bold; text-transform:uppercase;">LEGGER NILAI RAPOR PESERTA DIDIK</div>
        <div style="font-size:10pt; font-weight:bold;">${escapeHtml(config.Nama_Sekolah || '')} — KELAS ${escapeHtml(bundle.kelas)}</div>
        <div style="font-size:9pt;">Tahun Ajaran ${escapeHtml(config.Tahun_Ajaran_Aktif || '')} • Semester ${escapeHtml(config.Semester_Aktif || '')}</div>
      </div>

      <table class="tbl-legger">
        <thead>
          <tr>
            <th rowspan="2" style="width:24px;">No</th>
            <th rowspan="2" style="width:70px;">NISN</th>
            <th rowspan="2" style="min-width:140px;">Nama Peserta Didik</th>
            <th rowspan="2" style="width:24px;">L/P</th>
            <th colspan="${mapels.length}">Nilai Akhir Mata Pelajaran</th>
            <th rowspan="2" style="width:42px;">Jml</th>
            <th rowspan="2" style="width:42px;">Rata2</th>
            <th rowspan="2" style="width:36px;">Rank</th>
            <th colspan="3">Absensi</th>
          </tr>
          <tr>
            ${thMapels}
            <th style="width:24px;">I</th>
            <th style="width:24px;">S</th>
            <th style="width:24px;">A</th>
          </tr>
        </thead>
        <tbody>
          ${bodyRows}
          <tr style="background:#f1f5f9; font-weight:bold;"><td colspan="4" style="text-align:right;">Rata-rata Kelas</td>${rowAvg}<td colspan="6"></td></tr>
          <tr style="background:#f8fafc; font-weight:bold;"><td colspan="4" style="text-align:right;">Nilai Tertinggi</td>${rowMax}<td colspan="6"></td></tr>
          <tr style="background:#f8fafc; font-weight:bold;"><td colspan="4" style="text-align:right;">Nilai Terendah</td>${rowMin}<td colspan="6"></td></tr>
        </tbody>
      </table>

      <table style="width:100%; margin-top:14px; font-size:9pt;">
        <tr>
          <td style="width:65%;"></td>
          <td style="width:35%;">
            <div>${escapeHtml(config.Kota_Rapor || 'Kota')}, ${escapeHtml(config.Tanggal_Rapor || '')}</div>
            <div>Wali Kelas ${escapeHtml(bundle.kelas)},</div>
            <div style="height:44px;"></div>
            <div style="font-weight:bold; text-decoration:underline;">${escapeHtml((bundle.waliKelas || {}).Nama_Lengkap || '')}</div>
            <div>NIP. ${escapeHtml((bundle.waliKelas || {}).NIP || '-')}</div>
          </td>
        </tr>
      </table>
    </div>`;
}
