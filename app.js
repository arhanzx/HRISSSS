
// ============================================================
// ADMIN / PROFIL DROPDOWN
// ============================================================

function toggleAdminProfileMenu(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById("adminProfileMenu");
  if (!menu) return;
  menu.classList.toggle("show");
}

function closeAdminProfileMenu() {
  const menu = document.getElementById("adminProfileMenu");
  if (menu) menu.classList.remove("show");
}

document.addEventListener("click", function(event) {
  const wrap = event.target.closest(".admin-profile-wrap");
  if (!wrap) closeAdminProfileMenu();
});


// ============================================================
// ADMIN / KELUAR AKUN
// ============================================================

function adminLogout(){
  session={role:null,empId:null};
  closeAdminProfileMenu();
  closeModal();
  setScreen("loginScreen");
}

// ============================================================
// NADI HRIS - JAVASCRIPT
// Semua JavaScript berada dalam SATU file.
// Komentar pembatas dibuat agar setiap fitur mudah ditemukan.
// ============================================================

// ============================================================
// DATA / STATE APLIKASI
// ============================================================
/* ===================== DATA + SUPABASE ===================== */
const ADMIN_PASSWORD = "admin123";

let employees = [];
let attendance = [];
let leaves = [];
let leaveSeq = 3, attSeq = 1;
let session = {role:null, empId:null};
let cameraStream = null;
let pendingCapture = {photo:null, loc:null, type:null};

const supabaseConfig = window.SUPABASE_CONFIG || {};
const supabaseClient = (window.supabase && supabaseConfig.url && supabaseConfig.anonKey)
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;
window.supabaseClient = supabaseClient;
let salaryPublicationsCache = {};
let salaryEditsCache = {};

function requireSupabase(){
  if(!supabaseClient) throw new Error("Supabase belum dikonfigurasi. Isi supabase-config.js terlebih dahulu.");
  return supabaseClient;
}
function joinToISO(join){
  const d=parseJoinDate(join);
  if(!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function isoToJoin(iso){
  if(!iso) return "";
  const [y,m,d]=String(iso).slice(0,10).split('-').map(Number);
  const names=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  return `${String(d).padStart(2,'0')} ${names[m-1]} ${y}`;
}
function employeeToRow(e){
  return {id:e.id,name:e.name,initials:e.initials,position:e.position,dept:e.dept,phone:e.phone,email:e.email,join_date:joinToISO(e.join),base:numberOrZero(e.base),allowance:numberOrZero(e.allowance),deduction:numberOrZero(e.deduction),updated_at:new Date().toISOString()};
}
function rowToEmployee(r){
  return {id:r.id,name:r.name,initials:r.initials||initialsOf(r.name||''),position:r.position||'',dept:r.dept||'',phone:r.phone||'',email:r.email||'',join:isoToJoin(r.join_date),base:Number(r.base)||0,allowance:Number(r.allowance)||0,deduction:Number(r.deduction)||0};
}
function attendanceToRow(a){
  return {id:a.id,emp_id:a.empId,date:a.date,check_in:a.checkIn,check_out:a.checkOut,photo_in:a.photoIn,photo_out:a.photoOut,loc_in:a.locIn,loc_out:a.locOut,status:a.status||null,updated_at:new Date().toISOString()};
}
function rowToAttendance(r){
  return {id:r.id,empId:r.emp_id,date:String(r.date).slice(0,10),checkIn:r.check_in,checkOut:r.check_out,photoIn:r.photo_in,photoOut:r.photo_out,locIn:r.loc_in,locOut:r.loc_out,status:r.status};
}
function leaveToRow(l){
  return {id:l.id,emp_id:l.empId,type:l.type,start_date:l.start,end_date:l.end,reason:l.reason,status:l.status,applied:l.applied,updated_at:new Date().toISOString()};
}
function rowToLeave(r){
  return {id:r.id,empId:r.emp_id,type:r.type,start:String(r.start_date).slice(0,10),end:String(r.end_date).slice(0,10),reason:r.reason||'',status:r.status||'Menunggu',applied:r.applied||''};
}

async function loadAppData(){
  if(!supabaseClient){
    showToast("Supabase belum dikonfigurasi; aplikasi berjalan tanpa database.");
    return;
  }
  try{
    const sb=requireSupabase();
    const [er,ar,lr,spr,ser]=await Promise.all([
      sb.from('employees').select('*').order('id'),
      sb.from('attendance').select('*').order('date',{ascending:false}),
      sb.from('leaves').select('*').order('created_at',{ascending:false}),
      sb.from('salary_publications').select('*'),
      sb.from('salary_edits').select('*')
    ]);
    for(const result of [er,ar,lr,spr,ser]) if(result.error) throw result.error;
    employees = (er.data || []).map(rowToEmployee);
    attendance=(ar.data||[]).map(rowToAttendance);
    leaves=(lr.data||[]).map(rowToLeave);
    salaryPublicationsCache={};
    (spr.data||[]).forEach(r=>salaryPublicationsCache[`${r.emp_id}_${r.month}`]=r);
    salaryEditsCache={};
    (ser.data||[]).forEach(r=>salaryEditsCache[`${r.emp_id}_${r.month}`]=r);
    const leaveNums=leaves.map(l=>Number(String(l.id||'').replace(/^L/,''))).filter(Number.isFinite);
    const attNums=attendance.map(a=>Number(String(a.id||'').replace(/^A/,''))).filter(Number.isFinite);
    leaveSeq=leaveNums.length?Math.max(...leaveNums)+1:3;
    attSeq=attNums.length?Math.max(...attNums)+1:1;
  }catch(error){
    console.error('Supabase load error',error);
    showToast('Gagal memuat data Supabase. Cek konfigurasi dan SQL.');
  }
}

async function saveAppData(){
  if(!supabaseClient) return false;
  try{
    const sb=requireSupabase();
    const [er,ar,lr]=await Promise.all([
      sb.from('employees').upsert(employees.map(employeeToRow)),
      sb.from('attendance').upsert(attendance.map(attendanceToRow)),
      sb.from('leaves').upsert(leaves.map(leaveToRow))
    ]);
    for(const result of [er,ar,lr]) if(result.error) throw result.error;
    return true;
  }catch(error){
    console.error('Supabase save error',error);
    showToast('Gagal menyimpan ke Supabase.');
    return false;
  }
}

async function deleteEmployeeFromDB(id){
  if(!supabaseClient) return;
  const {error}=await requireSupabase().from('employees').delete().eq('id',id);
  if(error){ console.error(error); showToast('Gagal menghapus dari Supabase.'); }
}

async function deleteLeaveFromDB(id){
  if(!supabaseClient) return;
  const {error}=await requireSupabase().from('leaves').delete().eq('id',id);
  if(error){ console.error(error); showToast('Gagal menghapus dari Supabase.'); }
}

async function deleteLeavesFromDB(ids){
  if(!supabaseClient || !ids || !ids.length) return;
  const {error}=await requireSupabase().from('leaves').delete().in('id',ids);
  if(error){ console.error(error); showToast('Gagal menghapus dari Supabase.'); }
}


/* ===================== HELPERS ===================== */
// ============================================================
// HELPER & DATA FORMATTING
// ============================================================
function rupiah(n){ return "Rp" + n.toLocaleString("id-ID"); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function todayLabel(){
  return new Date().toLocaleDateString("id-ID",{weekday:'long', day:'numeric', month:'long', year:'numeric'});
}
function nowTime(){ return new Date().toLocaleTimeString("id-ID",{hour:'2-digit',minute:'2-digit'}); }
// ============================================================
// MODAL & TOAST / NOTIFIKASI
// ============================================================
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._tm); t._tm = setTimeout(()=>t.classList.remove('show'), 2200);
}
function empById(id){ return employees.find(e=>e.id===id); }
function netSalary(e){ return e.base + e.allowance - e.deduction; }

/* ===================== MODAL ENGINE ===================== */
function openModal(title, bodyHTML, footHTML){
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHTML;
  const foot = document.getElementById('modalFoot');
  if(footHTML){ foot.innerHTML = footHTML; foot.classList.remove('hidden'); }
  else { foot.innerHTML=""; foot.classList.add('hidden'); }
  document.getElementById('modalBackdrop').classList.add('open');
}
function closeModal(){
  const backdrop=document.getElementById('modalBackdrop');
  if(backdrop) backdrop.classList.remove('open');
  if(typeof stopCamera==="function") stopCamera();
}
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });

/* ===================== LOGIN FLOW ===================== */
// ============================================================
// LOGIN & SESSION
// ============================================================

function setScreen(screenId){
  ["loginScreen","empApp","admApp"].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.classList.toggle("hidden",id!==screenId);
  });
}

async function openEmployeePicker(){
  if(window.dataReady) await window.dataReady;
  const options=employees.map(e=>`<option value="${e.id}">${e.name} — ${e.position}</option>`).join("");
  openModal(
    "Pilih Akun Karyawan",
    `<p class="field-hint" style="margin-bottom:14px;">Demo: pilih akun karyawan untuk masuk tanpa kata sandi.</p>
     <div class="field">
       <label>Nama Karyawan</label>
       <select id="pickEmp">${options}</select>
     </div>`,
    `<button class="btn btn-navy" type="button" onclick="loginAsEmployee()">Masuk</button>`
  );
}

function loginAsEmployee(){
  const picker=document.getElementById("pickEmp");
  const id=picker ? picker.value : "";
  const employee=empById(id);

  if(!employee){
    showToast("Akun karyawan tidak ditemukan.");
    return;
  }

  session={role:"employee",empId:id};
  closeModal();
  setScreen("empApp");

  const avatar=document.getElementById("empAvatar");
  if(avatar) avatar.textContent=employee.initials;

  setEmpTab("beranda");
  showToast(`Selamat datang, ${employee.name.split(" ")[0]}`);
}

function openAdminLoginModal(){
  openModal(
    "Akses Admin HR",
    `<p class="field-hint" style="margin-bottom:14px;">Halaman ini khusus tim HR. Masukkan kata sandi admin untuk melanjutkan.</p>
     <div class="field">
       <label>Kata Sandi Admin</label>
       <input type="password" id="admPass" placeholder="Masukkan kata sandi"
         autocomplete="current-password"
         onkeydown="if(event.key==='Enter') loginAsAdmin()">
     </div>
     <p id="admPassErr" class="field-hint hidden" style="color:var(--red);font-weight:600;">Kata sandi salah. Coba lagi.</p>`,
    `<button class="btn btn-red" type="button" onclick="loginAsAdmin()">Masuk sebagai Admin</button>`
  );
  setTimeout(()=>document.getElementById("admPass")?.focus(),150);
}

function loginAsAdmin(){
  const input=document.getElementById("admPass");
  const val=input ? input.value : "";
  const err=document.getElementById("admPassErr");

  if(val!==ADMIN_PASSWORD){
    if(err) err.classList.remove("hidden");
    if(input) input.focus();
    return;
  }

  session={role:"admin",empId:null};
  closeModal();
  setScreen("admApp");
  setAdmTab("dashboard");
  showToast("Masuk sebagai Admin HR");
}

function adminLogout(){
  session={role:null,empId:null};
  closeAdminProfileMenu();
  closeModal();
  setScreen("loginScreen");
}

function logout(){
  adminLogout();
}

/* ===================== EMPLOYEE TABS ===================== */
const empTitles = {beranda:"Beranda", absen:"Absen Kehadiran", cuti:"Pengajuan Cuti", gaji:"Gaji Saya", profil:"Profil Saya"};
let empActiveTab = 'beranda';
function setEmpTab(tab){
  empActiveTab = tab;
  document.getElementById('empHeaderTitle').textContent = empTitles[tab];
  document.querySelectorAll('#empTabbar .tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  const c = document.getElementById('empContent');
  if(tab==='beranda') c.innerHTML = renderEmpHome();
  if(tab==='absen') c.innerHTML = renderEmpAbsen();
  if(tab==='cuti') c.innerHTML = renderEmpCuti();
  if(tab==='gaji') c.innerHTML = renderEmpGaji();
  if(tab==='profil') c.innerHTML = renderEmpProfil();
  c.scrollTop = 0;
}

function empAttendanceThisMonth(empId){
  return attendance.filter(a=>a.empId===empId).length;
}
function empTodayRecord(){
  return attendance.find(a=>a.empId===session.empId && a.date===todayISO());
}

// ============================================================
// EMPLOYEE / KARYAWAN
// ============================================================
function renderEmpHome(){
  const e = empById(session.empId);
  const hadir = empAttendanceThisMonth(e.id);
  const cutiSaya = leaves.filter(l=>l.empId===e.id);
  const pending = cutiSaya.filter(l=>l.status==='Menunggu').length;
  return `
    <div class="hero-card">
      <p class="hero-greet">${todayLabel()}</p>
      <p class="hero-name">Halo, ${e.name.split(" ")[0]} 👋</p>
      <div class="hero-stats">
        <div class="hero-stat"><div class="v">${hadir}</div><div class="l">Hadir bulan ini</div></div>
        <div class="hero-stat"><div class="v">12</div><div class="l">Sisa jatah cuti</div></div>
        <div class="hero-stat"><div class="v">${pending}</div><div class="l">Cuti menunggu</div></div>
      </div>
    </div>

    <p class="section-label">Aksi Cepat</p>
    <div class="grid2" style="margin-bottom:14px;">
      <div class="stat-box blue" style="cursor:pointer" onclick="setEmpTab('absen')">
        <div style="font-size:20px; margin-bottom:6px;">📍</div>
        <div class="lbl" style="font-weight:700; color:var(--navy);">Absen Sekarang</div>
      </div>
      <div class="stat-box red" style="cursor:pointer" onclick="openLeaveForm()">
        <div style="font-size:20px; margin-bottom:6px;">🗓️</div>
        <div class="lbl" style="font-weight:700; color:var(--red);">Ajukan Cuti</div>
      </div>
    </div>

    <p class="section-label">Status Hari Ini</p>
    <div class="card">
      ${renderTodayStatusRow()}
    </div>
  `;
}
function renderTodayStatusRow(){
  const r = empTodayRecord();
  if(!r) return `<div class="row"><span style="font-size:13.5px; color:var(--muted);">Belum absen masuk</span><span class="badge amber">Belum Hadir</span></div>`;
  return `
    <div class="row" style="margin-bottom:${r.checkOut?'10px':'0'}">
      <span style="font-size:13.5px; color:var(--muted);">Absen masuk</span>
      <span style="font-weight:700; font-size:13.5px;">${r.checkIn}</span>
    </div>
    ${r.checkOut ? `<div class="row"><span style="font-size:13.5px; color:var(--muted);">Absen pulang</span><span style="font-weight:700; font-size:13.5px;">${r.checkOut}</span></div>` : ''}
  `;
}

function renderEmpAbsen(){
  const r = empTodayRecord();
  const mine = attendance.filter(a=>a.empId===session.empId).slice().reverse();
  let actionBtn;
  if(!r){
    actionBtn = `<button class="btn btn-navy" onclick="startAbsen('checkin')">📷 Absen Masuk</button>`;
  } else if(!r.checkOut){
    actionBtn = `<button class="btn btn-red" onclick="startAbsen('checkout')">📷 Absen Pulang</button>`;
  } else {
    actionBtn = `<button class="btn btn-soft" disabled style="opacity:.6">✓ Absensi hari ini selesai</button>`;
  }
  return `
    <div class="card" style="text-align:center; padding:22px 16px;">
      <p style="font-size:12.5px; color:var(--muted); margin:0 0 4px;">${todayLabel()}</p>
      <p style="font-size:28px; font-weight:800; margin:0 0 16px;" id="liveClock">${nowTime()}</p>
      ${actionBtn}
    </div>
    <p class="section-label">Riwayat Absensi</p>
    ${mine.length===0 ? emptyState("🕒","Belum ada riwayat","Riwayat absensimu akan muncul di sini") :
      mine.map(a=>`
        <div class="card" style="margin-bottom:10px;">
          <div class="row" style="margin-bottom:8px;">
            <span style="font-weight:700; font-size:13.5px;">${formatDateID(a.date)}</span>
            <span class="badge ${a.checkOut ? 'green':'amber'}">${a.checkOut ? 'Lengkap':'Belum Pulang'}</span>
          </div>
          <div class="row"><span style="font-size:12.5px; color:var(--muted);">Masuk</span><span style="font-size:12.5px; font-weight:600;">${a.checkIn} · ${a.locIn}</span></div>
          ${a.checkOut ? `<div class="row" style="margin-top:5px;"><span style="font-size:12.5px; color:var(--muted);">Pulang</span><span style="font-size:12.5px; font-weight:600;">${a.checkOut} · ${a.locOut}</span></div>` : ''}
        </div>
      `).join("")
    }
  `;
}
function formatDateID(iso){
  return new Date(iso+"T00:00:00").toLocaleDateString("id-ID",{day:'numeric', month:'short', year:'numeric'});
}
function emptyState(icon,title,desc){
  return `<div class="empty-state"><div class="eicon">${icon}</div><div class="etitle">${title}</div><div class="edesc">${desc}</div></div>`;
}

function renderEmpCuti(){
  const mine = leaves.filter(l=>l.empId===session.empId).slice().reverse();
  return `
    <div class="card" style="background:var(--blue-soft); border:none; margin-bottom:16px;">
      <div class="row">
        <div>
          <p style="margin:0; font-size:12.5px; color:var(--navy); font-weight:600;">Sisa jatah cuti tahunan</p>
          <p style="margin:4px 0 0; font-size:22px; font-weight:800; color:var(--navy);">12 hari</p>
        </div>
        <button class="btn btn-navy btn-sm" onclick="openLeaveForm()">+ Ajukan Cuti</button>
      </div>
    </div>
    <p class="section-label">Riwayat Pengajuan</p>
    ${mine.length===0 ? emptyState("🗓️","Belum ada pengajuan","Ajukan cuti melalui tombol di atas") :
      mine.map(l=>`
        <div class="list-item" onclick="viewLeaveDetail('${l.id}')">
          <div class="li-avatar">🗓️</div>
          <div style="flex:1;">
            <p class="li-title">${l.type}</p>
            <p class="li-sub">${formatDateID(l.start)} – ${formatDateID(l.end)}</p>
          </div>
          ${leaveBadge(l.status)}
        </div>
      `).join("")
    }
  `;
}
function leaveBadge(status){
  const map = {"Menunggu":"amber","Disetujui":"green","Ditolak":"red"};
  return `<span class="badge ${map[status]}">${status}</span>`;
}
function viewLeaveDetail(id){
  const l = leaves.find(x=>x.id===id);
  const e = empById(l.empId);
  openModal("Detail Pengajuan Cuti", `
    <div class="row" style="margin-bottom:14px;">${leaveBadge(l.status)}<span style="font-size:12px; color:var(--muted);">Diajukan ${l.applied}</span></div>
    <div class="slip-line"><span>Nama</span><span style="font-weight:700;">${e.name}</span></div>
    <div class="slip-line"><span>Jenis Cuti</span><span style="font-weight:700;">${l.type}</span></div>
    <div class="slip-line"><span>Mulai</span><span style="font-weight:700;">${formatDateID(l.start)}</span></div>
    <div class="slip-line"><span>Selesai</span><span style="font-weight:700;">${formatDateID(l.end)}</span></div>
    <p style="font-size:12.5px; font-weight:700; margin:16px 0 6px;">Alasan</p>
    <p style="font-size:13.5px; color:var(--text); background:var(--surface); padding:12px; border-radius:12px; margin:0;">${l.reason}</p>
  `);
}
function openLeaveForm(){
  openModal("Ajukan Cuti", `
    <div class="field">
      <label>Jenis Cuti</label>
      <select id="lvType">
        <option>Cuti Tahunan</option>
        <option>Sakit</option>
        <option>Cuti Melahirkan</option>
        <option>Izin Keperluan Pribadi</option>
      </select>
    </div>
    <div class="field-2col">
      <div class="field"><label>Tanggal Mulai</label><input type="date" id="lvStart"></div>
      <div class="field"><label>Tanggal Selesai</label><input type="date" id="lvEnd"></div>
    </div>
    <div class="field">
      <label>Alasan</label>
      <textarea id="lvReason" placeholder="Jelaskan alasan pengajuan cuti..."></textarea>
    </div>
  `, `<button class="btn btn-navy" onclick="submitLeave()">Kirim Pengajuan</button>`);
}
function submitLeave(){
  const type = document.getElementById('lvType').value;
  const start = document.getElementById('lvStart').value;
  const end = document.getElementById('lvEnd').value;
  const reason = document.getElementById('lvReason').value.trim();
  if(!start || !end || !reason){ showToast("Lengkapi semua kolom terlebih dahulu"); return; }
  leaves.push({id:"L"+String(leaveSeq++).padStart(2,'0'), empId:session.empId, type, start, end, reason, status:"Menunggu", applied: new Date().toLocaleDateString("id-ID",{day:'numeric',month:'short',year:'numeric'})});
  saveAppData();
  closeModal();
  showToast("Pengajuan cuti terkirim");
  if(empActiveTab==='cuti') setEmpTab('cuti');
}


// ============================================================
// PAYROLL / SLIP GAJI & PENERBITAN ADMIN
// ============================================================

function parseJoinDate(joinText) {
  if (!joinText) return null;
  const months={Jan:0,Feb:1,Mar:2,Apr:3,Mei:4,May:4,Jun:5,Jul:6,Agu:7,Aug:7,Sep:8,Okt:9,Oct:9,Nov:10,Des:11,Dec:11};
  const m=String(joinText).trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if(!m || months[m[2]]===undefined) return null;
  return new Date(Number(m[3]),months[m[2]],Number(m[1]));
}

function getEmployeePayday(employee) {
  const d=parseJoinDate(employee?.join);
  return d ? d.getDate() : null;
}

function getPaydayDate(year, monthIndex, employee) {
  const payday=getEmployeePayday(employee);
  if(!payday) return null;
  return Math.min(payday,new Date(year,monthIndex+1,0).getDate());
}

function currentMonthKey() {
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

function isSalaryReleased(employee, month) {
  const joinDate=parseJoinDate(employee?.join);
  if(!joinDate) return false;

  const [year,monthNumber]=month.split("-").map(Number);
  const periodStart=new Date(year,monthNumber-1,1);
  const joinMonth=new Date(joinDate.getFullYear(),joinDate.getMonth(),1);
  if(periodStart<joinMonth) return false;

  const now=new Date();
  const currentStart=new Date(now.getFullYear(),now.getMonth(),1);

  if(periodStart<currentStart) return true;
  if(periodStart>currentStart) return false;

  const payday=getPaydayDate(year,monthNumber-1,employee);
  return payday!==null && now.getDate()>=payday;
}

// Semua bulan masa kerja tetap ditampilkan di menu Gaji.
// Bulan berjalan juga ditampilkan walaupun belum diterbitkan.
function getSalaryPeriods(employee) {
  const joinDate=parseJoinDate(employee?.join);
  if(!joinDate) return [];

  const now=new Date();
  const start=new Date(joinDate.getFullYear(),joinDate.getMonth(),1);
  const current=new Date(now.getFullYear(),now.getMonth(),1);
  const periods=[];
  const cursor=new Date(start);

  while(cursor<=current && periods.length<120){
    periods.push(`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,"0")}`);
    cursor.setMonth(cursor.getMonth()+1);
  }
  return periods.reverse();
}

function salaryStatus(employee,month) {
  return isSalaryReleased(employee,month)
    ? "Slip gaji sudah diterbitkan"
    : "Slip gaji belum diterbitkan";
}

// ---- Penerbitan oleh Admin ----
const SALARY_PUBLICATION_KEY="nadi_salary_publications";

function getSalaryPublications(){ return salaryPublicationsCache; }

async function saveSalaryPublications(data){
  salaryPublicationsCache=data||{};
  if(!supabaseClient) return;
  const sb=requireSupabase();
  const rows=Object.values(salaryPublicationsCache).map(x=>({emp_id:x.empId,month:x.month,published:Boolean(x.published),published_at:x.publishedAt||null,admin_override:Boolean(x.adminOverride)}));
  const {error}=await sb.from('salary_publications').upsert(rows);
  if(error){console.error(error);showToast('Gagal menyimpan status slip gaji.');}
}

function salaryPublicationKey(empId,month){
  return `${empId}_${month}`;
}

function isSalaryPublished(employee,month){
  const data=getSalaryPublications();
  const item=data[salaryPublicationKey(employee.id,month)];
  return Boolean(item && item.published===true);
}

function salaryPublicationStatus(employee,month){
  return isSalaryPublished(employee,month) ? "published" : "unpublished";
}

function publishSalarySlip(empId,month,adminOverride=false){
  const employee=empById(empId);
  if(!employee)return;

  const joinDate=parseJoinDate(employee.join);
  const [year,monthNumber]=month.split("-").map(Number);
  const periodStart=new Date(year,monthNumber-1,1);
  const joinMonth=joinDate?new Date(joinDate.getFullYear(),joinDate.getMonth(),1):null;

  if(!joinMonth||periodStart<joinMonth){
    showToast("Periode sebelum tanggal bergabung tidak dapat diterbitkan.");
    return;
  }

  if(!adminOverride&&!isSalaryReleased(employee,month)){
    showToast("Belum mencapai tanggal gajian.");
    return;
  }

  const data=getSalaryPublications();
  const publicationKey=salaryPublicationKey(empId,month);
  data[publicationKey]={
    empId,
    month,
    published:true,
    publishedAt:new Date().toISOString(),
    adminOverride:!!adminOverride
  };
  saveSalaryPublications(data);

  // Read back immediately so the employee side uses the same persisted state.
  const verify=getSalaryPublications()[publicationKey];
  if(!verify || verify.published!==true){
    showToast("Gagal menyimpan status penerbitan slip.");
    return;
  }

  showToast(`Slip ${monthLabel(month)} berhasil diterbitkan`);
  closeModal();
  if(typeof admActiveTab!=="undefined"&&admActiveTab==="penggajian")setAdmTab("penggajian");
}


async function unpublishSalarySlip(empId,month){
  const data=getSalaryPublications();
  delete data[salaryPublicationKey(empId,month)];
  if(supabaseClient){
    const {error}=await requireSupabase().from('salary_publications').delete().eq('emp_id',empId).eq('month',month);
    if(error){console.error(error);showToast('Gagal membatalkan penerbitan slip.');return;}
  }
  salaryPublicationsCache=data;

  showToast(`Penerbitan slip ${monthLabel(month)} dibatalkan`);
  closeModal();
  if(typeof admActiveTab!=="undefined" && admActiveTab==="penggajian") setAdmTab("penggajian");
}


// ============================================================
// PAYROLL - EDIT PER BULAN
// ============================================================

const SALARY_EDIT_KEY="nadi_salary_edits";

function getSalaryEdits(){ return salaryEditsCache; }

async function saveSalaryEdits(data){
  salaryEditsCache=data||{};
  if(!supabaseClient) return;
  const rows=Object.values(salaryEditsCache).map(x=>({emp_id:x.empId,month:x.month,components:x.components||{},net_salary:Number(x.netSalary)||0,updated_at:x.updatedAt||new Date().toISOString()}));
  const {error}=await requireSupabase().from('salary_edits').upsert(rows);
  if(error){console.error(error);showToast('Gagal menyimpan perubahan gaji.');}
}

function salaryEditKey(empId,month){
  return `${empId}_${month}`;
}

function numberOrZero(value){
  const n=Number(value);
  return Number.isFinite(n) && n>=0 ? n : 0;
}

/*
 * Komponen payroll disimpan per KARYAWAN + BULAN.
 * Ini membuat edit Januari tidak mengubah Februari.
 * Default tetap mengambil data gaji lama dari profil karyawan.
 */
function getPayrollComponents(employee,month){
  const edits=getSalaryEdits();
  const saved=edits[salaryEditKey(employee.id,month)];

  // Format baru: menyimpan seluruh komponen.
  if(saved && saved.components){
    const c=saved.components;
    return {
      base:numberOrZero(c.base),
      allowance:numberOrZero(c.allowance),
      overtime:numberOrZero(c.overtime),
      bonus:numberOrZero(c.bonus),
      otherIncome:numberOrZero(c.otherIncome),
      bpjs:numberOrZero(c.bpjs),
      tax:numberOrZero(c.tax),
      otherDeduction:numberOrZero(c.otherDeduction),
      note:String(c.note||"")
    };
  }

  // Kompatibilitas dengan data lama yang hanya menyimpan netSalary.
  const base=numberOrZero(employee.base);
  const allowance=numberOrZero(employee.allowance);
  const oldDeduction=numberOrZero(employee.deduction);

  if(saved && Number.isFinite(Number(saved.netSalary))){
    const target=numberOrZero(saved.netSalary);
    const baseGross=base+allowance;
    const inferredDeduction=Math.max(0,baseGross-target);
    return {
      base, allowance, overtime:0, bonus:0, otherIncome:0,
      bpjs:inferredDeduction, tax:0, otherDeduction:0, note:""
    };
  }

  return {
    base,
    allowance,
    overtime:0,
    bonus:0,
    otherIncome:0,
    bpjs:oldDeduction,
    tax:0,
    otherDeduction:0,
    note:""
  };
}

function payrollGross(c){
  return numberOrZero(c.base)
    +numberOrZero(c.allowance)
    +numberOrZero(c.overtime)
    +numberOrZero(c.bonus)
    +numberOrZero(c.otherIncome);
}

function payrollDeductions(c){
  return numberOrZero(c.bpjs)
    +numberOrZero(c.tax)
    +numberOrZero(c.otherDeduction);
}

function payrollNet(c){
  return Math.max(0,payrollGross(c)-payrollDeductions(c));
}

function savePayrollComponents(employee,month,components){
  const edits=getSalaryEdits();
  const c={
    base:numberOrZero(components.base),
    allowance:numberOrZero(components.allowance),
    overtime:numberOrZero(components.overtime),
    bonus:numberOrZero(components.bonus),
    otherIncome:numberOrZero(components.otherIncome),
    bpjs:numberOrZero(components.bpjs),
    tax:numberOrZero(components.tax),
    otherDeduction:numberOrZero(components.otherDeduction),
    note:String(components.note||"")
  };

  edits[salaryEditKey(employee.id,month)]={
    empId:employee.id,
    month,
    components:c,
    netSalary:payrollNet(c),
    updatedAt:new Date().toISOString()
  };

  saveSalaryEdits(edits);
}

function getEditedSalary(employee,month){
  const item=getSalaryEdits()[salaryEditKey(employee.id,month)];
  if(!item)return null;

  if(item.components){
    return payrollNet(item.components);
  }

  return Number.isFinite(Number(item.netSalary))
    ? Number(item.netSalary)
    : null;
}

function salaryForPeriod(employee,month){
  return payrollNet(getPayrollComponents(employee,month));
}


function openSalaryRuleForMonth(empId,month){
  const e=empById(empId);
  if(!e)return;

  const c=getPayrollComponents(e,month);
  const gross=payrollGross(c);
  const deductions=payrollDeductions(c);
  const net=payrollNet(c);

  openModal(
    `Edit Slip Gaji · ${e.name} · ${monthLabel(month)}`,
    `
      <div class="payroll-edit-grid">
        <p class="payroll-edit-section">PENDAPATAN</p>

        <div class="field"><label>Gaji Pokok</label>
          <input id="payBase" class="form-input" type="number" min="0" step="1000" value="${c.base}"></div>

        <div class="field"><label>Tunjangan</label>
          <input id="payAllowance" class="form-input" type="number" min="0" step="1000" value="${c.allowance}"></div>

        <div class="field"><label>Lembur</label>
          <input id="payOvertime" class="form-input" type="number" min="0" step="1000" value="${c.overtime}"></div>

        <div class="field"><label>Bonus / Insentif</label>
          <input id="payBonus" class="form-input" type="number" min="0" step="1000" value="${c.bonus}"></div>

        <div class="field"><label>Pendapatan Lainnya</label>
          <input id="payOtherIncome" class="form-input" type="number" min="0" step="1000" value="${c.otherIncome}"></div>

        <p class="payroll-edit-section">POTONGAN</p>

        <div class="field"><label>BPJS</label>
          <input id="payBpjs" class="form-input" type="number" min="0" step="1000" value="${c.bpjs}"></div>

        <div class="field"><label>PPh 21 / Pajak</label>
          <input id="payTax" class="form-input" type="number" min="0" step="1000" value="${c.tax}"></div>

        <div class="field"><label>Potongan Lainnya</label>
          <input id="payOtherDeduction" class="form-input" type="number" min="0" step="1000" value="${c.otherDeduction}"></div>

        <div class="field"><label>Catatan Slip</label>
          <textarea id="payNote" class="form-input" rows="3" placeholder="Catatan tambahan...">${c.note||""}</textarea></div>

        <div class="payroll-summary">
          <div><span>Total Pendapatan</span><strong id="payGrossPreview">${rupiah(gross)}</strong></div>
          <div><span>Total Potongan</span><strong id="payDeductionPreview">-${rupiah(deductions)}</strong></div>
          <div class="payroll-net"><span>Total Diterima</span><strong id="payNetPreview">${rupiah(net)}</strong></div>
        </div>
      </div>
    `,
    `<button class="btn btn-navy" type="button" onclick="savePayrollForMonth('${e.id}','${month}')">Simpan Slip</button>`
  );

  setTimeout(()=>bindPayrollPreview(),50);
}

function payrollInputNumber(id){
  const n=Number(document.getElementById(id)?.value);
  return Number.isFinite(n)&&n>=0?n:0;
}

function readPayrollForm(){
  return {
    base:payrollInputNumber("payBase"),
    allowance:payrollInputNumber("payAllowance"),
    overtime:payrollInputNumber("payOvertime"),
    bonus:payrollInputNumber("payBonus"),
    otherIncome:payrollInputNumber("payOtherIncome"),
    bpjs:payrollInputNumber("payBpjs"),
    tax:payrollInputNumber("payTax"),
    otherDeduction:payrollInputNumber("payOtherDeduction"),
    note:document.getElementById("payNote")?.value?.trim()||""
  };
}

function bindPayrollPreview(){
  ["payBase","payAllowance","payOvertime","payBonus","payOtherIncome","payBpjs","payTax","payOtherDeduction"]
    .forEach(id=>document.getElementById(id)?.addEventListener("input",updatePayrollPreview));
  updatePayrollPreview();
}

function updatePayrollPreview(){
  const c=readPayrollForm();
  const gross=payrollGross(c);
  const deductions=payrollDeductions(c);
  const net=payrollNet(c);

  const a=document.getElementById("payGrossPreview");
  const b=document.getElementById("payDeductionPreview");
  const d=document.getElementById("payNetPreview");
  if(a)a.textContent=rupiah(gross);
  if(b)b.textContent="-"+rupiah(deductions);
  if(d)d.textContent=rupiah(net);
}

function savePayrollForMonth(empId,month){
  const e=empById(empId);
  if(!e)return;

  const c=readPayrollForm();
  savePayrollComponents(e,month,c);

  showToast(`Slip ${monthLabel(month)} berhasil diperbarui`);
  closeModal();

  if(typeof admActiveTab!=="undefined"&&admActiveTab==="penggajian"){
    setAdmTab("penggajian");
  }
}


function refreshEmployeePayroll(){
  if(session?.role==="employee"){
    const c=document.getElementById("empContent");
    if(c && typeof setEmpTab==="function") setEmpTab("gaji");
  }
}

function renderEmpGaji(){
  const e=empById(session.empId);
  const periods=getSalaryPeriods(e);
  const latestReleased=periods.find(m=>isSalaryPublished(e,m));

  return `
    <div class="hero-card">
      <p class="hero-greet">Gaji · ${latestReleased ? monthLabel(latestReleased) : "Belum diterbitkan"}</p>
      <p class="hero-name" style="font-size:24px;">${latestReleased ? rupiah(salaryForPeriod(e,latestReleased)) : rupiah(netSalary(e))}</p>
      ${latestReleased && isSalaryPublished(e,latestReleased)
        ? `<button class="btn" style="background:#fff;color:var(--navy);position:relative;z-index:1;" onclick="viewSlip('${latestReleased}')">Lihat Slip Gaji</button>`
        : `<button class="btn" style="background:#fff;color:var(--navy);position:relative;z-index:1;opacity:.65;cursor:not-allowed;" disabled>Slip Belum Diterbitkan</button>`
      }
    </div>

    <p class="section-label">Riwayat Slip Gaji</p>

    ${periods.length===0
      ? emptyState("💳","Belum ada periode gaji","Slip akan muncul sesuai masa kerja")
      : periods.map(m=>{
          const published=isSalaryPublished(e,m);
          const canOpen=published;

          return `
            <div class="list-item"
              ${canOpen ? `onclick="viewSlip('${m}')"` : `style="opacity:.72;cursor:not-allowed;"`}>
              <div class="li-avatar">💳</div>
              <div style="flex:1;">
                <p class="li-title">Slip Gaji ${monthLabel(m)}</p>
                <p class="li-sub">
                  ${canOpen
                    ? `${rupiah(salaryForPeriod(e,m))} · Slip gaji sudah diterbitkan`
                    : "Slip gaji belum diterbitkan"
                  }
                </p>
              </div>
              <span class="li-arrow">${canOpen ? "›" : "🔒"}</span>
            </div>
          `;
        }).join("")
    }
  `;
}

function monthLabel(m){
  const [y,mo] = m.split("-");
  return new Date(y, mo-1, 1).toLocaleDateString("id-ID",{month:'long', year:'numeric'});
}
function viewSlip(month){
  const e=empById(session.empId);

  if(!e || !isSalaryPublished(e,month)){
    showToast("Slip gaji belum diterbitkan.");
    return;
  }

  openModal(
    `Slip Gaji · ${monthLabel(month)}`,
    buildSlipBody(e,month),
    `<button class="btn btn-navy" onclick="downloadSlipWord('${e.id}','${month}')">📝 Download Slip Gaji (Word)</button>`
  );
}

function buildSlipBody(e,month){
  const c=getPayrollComponents(e,month);
  const gross=payrollGross(c);
  const deductions=payrollDeductions(c);
  const net=payrollNet(c);

  return `
    <div class="card" style="background:var(--surface);border:none;margin-bottom:16px;">
      <p style="margin:0;font-weight:800;font-size:15px;">${e.name}</p>
      <p style="margin:2px 0 0;font-size:12.5px;color:var(--muted);">${e.position} · ${e.dept}</p>
      <p style="margin:7px 0 0;font-size:12px;color:var(--muted);">Periode · ${monthLabel(month)}</p>
    </div>

    <p class="payroll-edit-section">PENDAPATAN</p>
    <div class="slip-line"><span>Gaji Pokok</span><span>${rupiah(c.base)}</span></div>
    <div class="slip-line"><span>Tunjangan</span><span>${rupiah(c.allowance)}</span></div>
    <div class="slip-line"><span>Lembur</span><span>${rupiah(c.overtime)}</span></div>
    <div class="slip-line"><span>Bonus / Insentif</span><span>${rupiah(c.bonus)}</span></div>
    <div class="slip-line"><span>Pendapatan Lainnya</span><span>${rupiah(c.otherIncome)}</span></div>
    <div class="slip-line total"><span>Total Pendapatan</span><span>${rupiah(gross)}</span></div>

    <p class="payroll-edit-section" style="margin-top:14px;">POTONGAN</p>
    <div class="slip-line"><span>BPJS</span><span>-${rupiah(c.bpjs)}</span></div>
    <div class="slip-line"><span>PPh 21 / Pajak</span><span>-${rupiah(c.tax)}</span></div>
    <div class="slip-line"><span>Potongan Lainnya</span><span>-${rupiah(c.otherDeduction)}</span></div>
    <div class="slip-line total"><span>Total Potongan</span><span>-${rupiah(deductions)}</span></div>

    <div class="slip-line total" style="margin-top:10px;font-size:15px;">
      <span>Total Diterima</span><span>${rupiah(net)}</span>
    </div>

    ${c.note ? `<div class="card" style="margin-top:14px;background:var(--surface);">
      <p style="margin:0 0 4px;font-weight:700;font-size:12px;">CATATAN</p>
      <p style="margin:0;font-size:13px;">${escapeHtml(c.note)}</p>
    </div>` : ""}
  `;
}

function escapeHtml(value){
  return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ============================================================
// DOWNLOAD SLIP GAJI WORD
// ============================================================

function escapeWordHtml(value){
  return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function downloadSlipWord(empId,month){
  const e=empById(empId);
  if(!e)return;

  if(session?.role==="employee" && !isSalaryPublished(e,month)){
    showToast("Slip gaji belum diterbitkan.");
    return;
  }

  const c=getPayrollComponents(e,month);
  const gross=payrollGross(c);
  const deductions=payrollDeductions(c);
  const net=payrollNet(c);

  const row=(label,value)=>`<tr><td>${escapeWordHtml(label)}</td><td>${escapeWordHtml(rupiah(value))}</td></tr>`;

  const content=`
<html>
<head><meta charset="utf-8">
<title>Slip Gaji ${escapeWordHtml(e.name)} - ${escapeWordHtml(monthLabel(month))}</title>
<style>
body{font-family:Arial,sans-serif;font-size:11pt;color:#222}
h1{text-align:center;font-size:18pt;margin-bottom:4px}
h2{text-align:center;font-size:12pt;font-weight:normal}
table{width:100%;border-collapse:collapse;margin-top:18px}
td,th{border:1px solid #999;padding:8px;text-align:left}
th{background:#f2f2f2}.total{font-weight:bold}
.note{margin-top:22px;padding:10px;border:1px solid #ccc}
</style></head>
<body>
<h1>SLIP GAJI</h1>
<h2>${escapeWordHtml(monthLabel(month))}</h2>

<table>
<tr><th>Nama Karyawan</th><td>${escapeWordHtml(e.name)}</td></tr>
<tr><th>Jabatan</th><td>${escapeWordHtml(e.position)}</td></tr>
<tr><th>Departemen</th><td>${escapeWordHtml(e.dept)}</td></tr>
<tr><th>Tanggal Bergabung</th><td>${escapeWordHtml(e.join)}</td></tr>
<tr><th>Periode</th><td>${escapeWordHtml(monthLabel(month))}</td></tr>
</table>

<table>
<tr><th colspan="2">PENDAPATAN</th></tr>
${row("Gaji Pokok",c.base)}
${row("Tunjangan",c.allowance)}
${row("Lembur",c.overtime)}
${row("Bonus / Insentif",c.bonus)}
${row("Pendapatan Lainnya",c.otherIncome)}
<tr class="total"><td>Total Pendapatan</td><td>${escapeWordHtml(rupiah(gross))}</td></tr>
</table>

<table>
<tr><th colspan="2">POTONGAN</th></tr>
${row("BPJS",c.bpjs)}
${row("PPh 21 / Pajak",c.tax)}
${row("Potongan Lainnya",c.otherDeduction)}
<tr class="total"><td>Total Potongan</td><td>-${escapeWordHtml(rupiah(deductions))}</td></tr>
<tr class="total"><td>Total Diterima</td><td>${escapeWordHtml(rupiah(net))}</td></tr>
</table>

${c.note?`<div class="note"><strong>Catatan:</strong><br>${escapeWordHtml(c.note)}</div>`:""}
<p style="margin-top:30px;font-size:9pt;color:#666">Dokumen diterbitkan melalui Nadi HRIS.</p>
</body></html>`;

  const blob=new Blob(["\ufeff",content],{type:"application/msword"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=`Slip-Gaji-${e.name.replace(/[^a-z0-9]+/gi,"-")}-${month}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function downloadSlip(empId, month){
  const e=empById(empId);
  if(!e)return;
  if(session?.role==="employee" && !isSalaryPublished(e,month)){
    showToast("Slip gaji belum diterbitkan.");
    return;
  }
  downloadSlipWord(empId,month);
}

function renderEmpProfil(){
  const e = empById(session.empId);
  return `
    <div class="card" style="text-align:center; padding:26px 16px;">
      <div class="li-avatar" style="width:64px; height:64px; border-radius:20px; font-size:22px; margin:0 auto 12px;">${e.initials}</div>
      <p style="font-weight:800; font-size:17px; margin:0;">${e.name}</p>
      <p style="font-size:13px; color:var(--muted); margin:3px 0 0;">${e.position} · ${e.dept}</p>
    </div>
    <p class="section-label">Informasi Karyawan</p>
    <div class="card">
      <div class="slip-line"><span>ID Karyawan</span><span style="font-weight:700;">${e.id}</span></div>
      <div class="slip-line"><span>Nomor HP</span><span style="font-weight:700;">${e.phone}</span></div>
      <div class="slip-line"><span>Email</span><span style="font-weight:700;">${e.email}</span></div>
      <div class="slip-line"><span>Tanggal Bergabung</span><span style="font-weight:700;">${e.join}</span></div>
    </div>
    <button class="btn btn-outline-red" style="margin-top:18px;" onclick="confirmLogoutEmp()">Keluar Akun</button>
  `;
}
function confirmLogoutEmp(){
  openModal("Keluar Akun", `<p style="font-size:14px; color:var(--text); margin:0;">Apakah kamu yakin ingin keluar dari akun ini?</p>`,
   `<div style="display:flex; gap:10px;">
      <button class="btn btn-soft" onclick="closeModal()">Batal</button>
      <button class="btn btn-red" onclick="logout()">Keluar</button>
    </div>`);
}

/* ===================== COMPANY GEOLOCATION / GEOFENCE ===================== */
// Lokasi perusahaan:
// Jalan Sultan Agung, Desa Karangrau, Kecamatan Sokaraja, Jawa Tengah
// Latitude  : -7.447312
// Longitude : 109.253745
//
// Radius absensi: 100 meter.
// Strategi GPS:
// 1) Coba posisi cepat dengan akurasi normal terlebih dahulu.
// 2) Jika belum valid, baru minta GPS akurasi tinggi.
// 3) Jangan menunggu tanpa batas; tampilkan alasan jika gagal.

const COMPANY_LOCATION = {
  latitude: -7.447312,
  longitude: 109.253745,
  radiusMeters: 100
};

function distanceInMeters(lat1, lon1, lat2, lon2){
  const R=6371000;
  const toRad=v=>v*Math.PI/180;
  const dLat=toRad(lat2-lat1);
  const dLon=toRad(lon2-lon1);
  const a=
    Math.sin(dLat/2)**2+
    Math.cos(toRad(lat1))*
    Math.cos(toRad(lat2))*
    Math.sin(dLon/2)**2;
  return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function checkCompanyLocation(position){
  const lat=position.coords.latitude;
  const lng=position.coords.longitude;
  const accuracy=Number(position.coords.accuracy)||9999;

  return {
    inside:distanceInMeters(
      lat,lng,
      COMPANY_LOCATION.latitude,
      COMPANY_LOCATION.longitude
    )<=COMPANY_LOCATION.radiusMeters,
    distance:distanceInMeters(
      lat,lng,
      COMPANY_LOCATION.latitude,
      COMPANY_LOCATION.longitude
    ),
    accuracy,
    latitude:lat,
    longitude:lng
  };
}

function setLocationStatus(text, state="pending"){
  const el=document.getElementById("locStatus");
  if(!el)return;
  el.className=`loc-pill ${state}`;
  el.innerHTML=text;
}

function finishLocationCheck(position){
  const result=checkCompanyLocation(position);

  if(!result.inside){
    pendingCapture.loc=null;
    setLocationStatus(
      `❌ Di luar area perusahaan (${Math.round(result.distance)} m) — absensi ditolak`,
      "error"
    );
    checkReadyToConfirm();
    return false;
  }

  pendingCapture.loc={
    coords:`${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)}`,
    distance:Math.round(result.distance),
    accuracy:Math.round(result.accuracy),
    verifiedAt:new Date().toISOString()
  };

  setLocationStatus(
    `📍 Lokasi terverifikasi · ${Math.round(result.distance)} m dari kantor`,
    "success"
  );
  checkReadyToConfirm();
  return true;
}

function initLocation(){
  if(!navigator.geolocation){
    pendingCapture.loc=null;
    setLocationStatus("❌ GPS tidak tersedia — absensi ditolak","error");
    checkReadyToConfirm();
    return;
  }

  let finished=false;
  let highAccuracyStarted=false;

  setLocationStatus("📡 Mencari lokasi…","pending");

  // Fast first attempt. This is much faster on phones because it can use
  // network-assisted positioning instead of waiting for a fresh GPS lock.
  navigator.geolocation.getCurrentPosition(
    position=>{
      if(finished)return;
      if(finishLocationCheck(position)){
        finished=true;
        return;
      }

      // Outside the radius: confirm with high-accuracy GPS before rejecting.
      startHighAccuracy();
    },
    ()=>{
      if(finished)return;
      startHighAccuracy();
    },
    {
      enableHighAccuracy:false,
      timeout:3000,
      maximumAge:5000
    }
  );

  function startHighAccuracy(){
    if(finished || highAccuracyStarted)return;
    highAccuracyStarted=true;

    setLocationStatus("🛰️ Mengunci GPS akurat…","pending");

    navigator.geolocation.getCurrentPosition(
      position=>{
        if(finished)return;
        finished=true;
        finishLocationCheck(position);
      },
      error=>{
        if(finished)return;
        finished=true;
        pendingCapture.loc=null;

        let msg="❌ Lokasi tidak dapat diverifikasi — absensi ditolak";
        if(error && error.code===1){
          msg="❌ Izin lokasi ditolak — aktifkan Location/GPS untuk absen";
        }else if(error && error.code===2){
          msg="❌ Posisi tidak tersedia — pastikan GPS aktif";
        }else if(error && error.code===3){
          msg="❌ GPS terlalu lama merespons — tekan Ambil Ulang";
        }

        setLocationStatus(msg,"error");
        checkReadyToConfirm();
      },
      {
        enableHighAccuracy:true,
        timeout:7000,
        maximumAge:0
      }
    );
  }
}

/* ===================== ABSEN: CAMERA + LOCATION ===================== */
// ============================================================
// ABSENSI / CAMERA / LOCATION
// ============================================================
function startAbsen(type){
  stopCamera();
  pendingCapture = {photo:null, loc:null, type};
  openModal(type==='checkin' ? "Absen Masuk" : "Absen Pulang", `
    <div class="cam-box" id="camBox">
      <div class="cam-placeholder">Memuat kamera...</div>
    </div>
    <div id="locStatus" class="loc-pill pending">📡 Mendeteksi lokasi...</div>
    <div id="camControls">
      <button class="btn btn-navy" id="captureBtn" onclick="capturePhoto()">📷 Ambil Foto</button>
    </div>
  `, `<button class="btn btn-navy" id="confirmAbsenBtn" disabled style="opacity:.5" onclick="confirmAbsen()">Konfirmasi Absen</button>`);
  initCamera();
  initLocation();
}
async function initCamera(){
  const box = document.getElementById('camBox');
  try{
    cameraStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"}, audio:false});
    box.innerHTML = `<video id="camVideo" autoplay playsinline muted></video>`;
    document.getElementById('camVideo').srcObject = cameraStream;
  }catch(err){
    box.innerHTML = `<div class="cam-placeholder">📷<br>Kamera tidak tersedia di perangkat/izin ini.<br>Foto simulasi akan digunakan.</div>`;
  }
}
function stopCamera(){
  if(cameraStream){ cameraStream.getTracks().forEach(t=>t.stop()); cameraStream = null; }
}
function capturePhoto(){
  const box = document.getElementById('camBox');
  const video = document.getElementById('camVideo');
  let dataUrl;
  if(video && video.videoWidth){
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video,0,0);
    dataUrl = canvas.toDataURL('image/jpeg', 0.7);
  }
  stopCamera();
  if(dataUrl){
    box.innerHTML = `<img src="${dataUrl}">`;
    pendingCapture.photo = dataUrl;
  } else {
    box.innerHTML = `<div class="cam-placeholder">✅<br>Foto simulasi tersimpan<br><span style="opacity:.7">(kamera tidak diizinkan)</span></div>`;
    pendingCapture.photo = "simulated";
  }
  document.getElementById('camControls').innerHTML = `<button class="btn btn-outline" onclick="startAbsen(pendingCapture.type)">🔄 Ambil Ulang</button>`;
  checkReadyToConfirm();
}
function checkReadyToConfirm(){
  const btn = document.getElementById('confirmAbsenBtn');
  if(!btn) return;

  const ready = Boolean(
    pendingCapture &&
    pendingCapture.photo &&
    pendingCapture.loc &&
    pendingCapture.loc.coords
  );

  btn.disabled = !ready;
  btn.style.opacity = ready ? 1 : .5;
}
function confirmAbsen(){
  if(!pendingCapture || !pendingCapture.loc){
    showToast("Absensi ditolak: lokasi perusahaan belum terverifikasi.");
    return;
  }

  const type = pendingCapture.type;
  const today = todayISO();
  let rec = attendance.find(a=>a.empId===session.empId && a.date===today);
  if(type==='checkin'){
    rec = {id:"A"+String(attSeq++).padStart(3,'0'), empId:session.empId, date:today, checkIn:nowTime(), checkOut:null, photoIn:pendingCapture.photo, locIn:pendingCapture.loc.coords||"Kantor Pusat", photoOut:null, locOut:null};
    attendance.push(rec);
    showToast("Absen masuk berhasil dicatat");
  } else if(rec){
    rec.checkOut = nowTime(); rec.photoOut = pendingCapture.photo; rec.locOut = pendingCapture.loc.coords||"Kantor Pusat";
    showToast("Absen pulang berhasil dicatat");
  }
  saveAppData();
  closeModal();
  if(empActiveTab==='absen') setEmpTab('absen');
  if(empActiveTab==='beranda') setEmpTab('beranda');
}

/* ===================== ADMIN TABS ===================== */
const admTitles = {dashboard:"Dashboard", karyawan:"Database Karyawan", absensi:"Rekap Absensi", penggajian:"Penggajian", cuti:"Pengajuan Cuti"};
let admActiveTab = 'dashboard';
function setAdmTab(tab){
  admActiveTab = tab;
  document.getElementById('admHeaderTitle').textContent = admTitles[tab];
  document.querySelectorAll('#admTabbar .tab-btn, #admSidebarNav .tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  const c = document.getElementById('admContent');
  if(tab==='dashboard') c.innerHTML = renderAdmDashboard();
  if(tab==='karyawan') c.innerHTML = renderAdmKaryawan();
  if(tab==='absensi') c.innerHTML = renderAdmAbsensi();
  if(tab==='penggajian') c.innerHTML = renderAdmPenggajian();
  if(tab==='cuti') c.innerHTML = renderAdmCuti();
  c.scrollTop = 0;
}

function renderAdmDashboard(){
  const hadirHariIni = attendance.filter(a=>a.date===todayISO()).length;
  const belumAbsen = Math.max(employees.length - hadirHariIni, 0);
  const pendingCuti = leaves.filter(l=>l.status==='Menunggu').length;
  const totalGaji = employees.reduce((s,e)=>s+netSalary(e),0);
  const hadirPct = employees.length ? Math.round((hadirHariIni/employees.length)*100) : 0;

  return `
    <div class="kpi-grid">
      <div class="kpi-card kpi-hero">
        <div class="kpi-top">
          <span class="kpi-label">Total Karyawan</span>
          <span class="kpi-icon">🗂️</span>
        </div>
        <div>
          <p class="kpi-value">${employees.length}</p>
          <p class="kpi-change">Terdaftar aktif di sistem</p>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top">
          <span class="kpi-label">Hadir Hari Ini</span>
          <span class="kpi-icon">✅</span>
        </div>
        <div>
          <p class="kpi-value">${hadirHariIni}</p>
          <p class="kpi-change up">${hadirPct}% dari total karyawan</p>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top">
          <span class="kpi-label">Cuti Menunggu</span>
          <span class="kpi-icon">🗓️</span>
        </div>
        <div>
          <p class="kpi-value">${pendingCuti}</p>
          <p class="kpi-change ${pendingCuti>0?'attn':''}">${pendingCuti>0?'Perlu ditinjau':'Tidak ada antrean'}</p>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top">
          <span class="kpi-label">Estimasi Gaji Bulan Ini</span>
          <span class="kpi-icon">💰</span>
        </div>
        <div>
          <p class="kpi-value" style="font-size:18px;">${rupiah(totalGaji)}</p>
          <p class="kpi-change">Berdasarkan aturan gaji aktif</p>
        </div>
      </div>
    </div>

    <div class="card">
      <p class="section-label" style="margin-top:0;">Absensi Hari Ini</p>
      <div class="att-progress">
        <div class="seg" style="width:${hadirPct}%; background:var(--green);"></div>
        <div class="seg" style="width:${100-hadirPct}%; background:var(--border);"></div>
      </div>
      <div class="att-legend">
        <div class="li"><span class="dot" style="background:var(--green);"></span><div><p class="lb">${hadirHariIni}</p><p class="lv">Sudah Absen</p></div></div>
        <div class="li"><span class="dot" style="background:var(--border);"></span><div><p class="lb">${belumAbsen}</p><p class="lv">Belum Absen</p></div></div>
      </div>
    </div>

    <p class="section-label">Pengajuan Cuti Terbaru</p>
    ${leaves.length===0 ? emptyState("🗓️","Belum ada pengajuan cuti","Pengajuan dari karyawan akan muncul di sini") :
    leaves.slice().reverse().slice(0,3).map(l=>{
      const e = empById(l.empId);
      return `<div class="list-item" onclick="setAdmTab('cuti')">
        <div class="li-avatar">${e.initials}</div>
        <div style="flex:1;"><p class="li-title">${e.name}</p><p class="li-sub">${l.type} · ${formatDateID(l.start)}</p></div>
        ${leaveBadge(l.status)}
      </div>`;
    }).join("")}
    <p class="section-label">Absensi Terbaru</p>
    ${attendance.slice().reverse().slice(0,3).map(a=>{
      const e = empById(a.empId);
      return `<div class="list-item" onclick="viewAttendanceDetail('${a.id}')">
        <div class="li-avatar">${e.initials}</div>
        <div style="flex:1;"><p class="li-title">${e.name}</p><p class="li-sub">Masuk ${a.checkIn} · ${a.locIn}</p></div>
        <span class="li-arrow">›</span>
      </div>`;
    }).join("") || emptyState("📍","Belum ada data absensi","Data akan muncul setelah karyawan absen")}
  `;
}

function renderAdmKaryawan(){
  return `
    <div class="search-bar"><span>🔍</span><input placeholder="Cari nama karyawan..." oninput="filterKaryawan(this.value)"></div>
    <button class="btn btn-navy btn-block-gap" onclick="openEmployeeForm()">+ Tambah Karyawan</button>
    <div id="karyawanList">${karyawanListHTML(employees)}</div>
  `;
}
function karyawanListHTML(list){
  if(list.length===0) return emptyState("🗂️","Karyawan tidak ditemukan","Coba kata kunci lain");
  return list.map(e=>`
    <div class="list-item" onclick="viewEmployeeDetail('${e.id}')">
      <div class="li-avatar">${e.initials}</div>
      <div style="flex:1;"><p class="li-title">${e.name}</p><p class="li-sub">${e.position} · ${e.dept}</p></div>
      <span class="li-arrow">›</span>
    </div>
  `).join("");
}
function filterKaryawan(q){
  const f = employees.filter(e=>e.name.toLowerCase().includes(q.toLowerCase()) || e.position.toLowerCase().includes(q.toLowerCase()));
  document.getElementById('karyawanList').innerHTML = karyawanListHTML(f);
}
function viewEmployeeDetail(id){
  const e = empById(id);
  openModal("Detail Karyawan", `
    <div class="card" style="text-align:center; background:var(--surface); border:none;">
      <div class="li-avatar" style="width:56px; height:56px; border-radius:18px; font-size:19px; margin:0 auto 10px;">${e.initials}</div>
      <p style="font-weight:800; font-size:16px; margin:0;">${e.name}</p>
      <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">${e.position} · ${e.dept}</p>
    </div>
    <div class="slip-line"><span>ID Karyawan</span><span style="font-weight:700;">${e.id}</span></div>
    <div class="slip-line"><span>Nomor HP</span><span style="font-weight:700;">${e.phone}</span></div>
    <div class="slip-line"><span>Email</span><span style="font-weight:700;">${e.email}</span></div>
    <div class="slip-line"><span>Bergabung</span><span style="font-weight:700;">${e.join}</span></div>
    <div class="slip-line"><span>Gaji Bersih</span><span style="font-weight:700;">${rupiah(netSalary(e))}</span></div>
  `, `
    <div style="display:flex; gap:10px;">
      <button class="btn btn-soft" onclick="openEmployeeForm('${e.id}')">✏️ Edit</button>
      <button class="btn btn-outline-red" onclick="confirmDeleteEmployee('${e.id}')">🗑 Hapus</button>
    </div>
  `);
}
// ============================================================
// MANAJEMEN DATA KARYAWAN
// ============================================================
function openEmployeeForm(id){
  const e = id ? empById(id) : null;
  openModal(e ? "Edit Data Karyawan" : "Tambah Karyawan Baru", `
    <div class="field"><label>Nama Lengkap</label><input id="fName" value="${e?e.name:''}"></div>
    <div class="field-2col">
      <div class="field"><label>Jabatan</label><input id="fPos" value="${e?e.position:''}"></div>
      <div class="field"><label>Departemen</label><input id="fDept" value="${e?e.dept:''}"></div>
    </div>
    <div class="field"><label>Nomor HP</label><input id="fPhone" value="${e?e.phone:''}"></div>
    <div class="field"><label>Email</label><input id="fEmail" value="${e?e.email:''}"></div>
  `, `<button class="btn btn-navy" onclick="saveEmployee(${e?`'${e.id}'`:'null'})">Simpan Data</button>`);
}
function saveEmployee(id){
  const name = document.getElementById('fName').value.trim();
  const position = document.getElementById('fPos').value.trim();
  const dept = document.getElementById('fDept').value.trim();
  const phone = document.getElementById('fPhone').value.trim();
  const email = document.getElementById('fEmail').value.trim();
  if(!name || !position){ showToast("Nama dan jabatan wajib diisi"); return; }
  if(id){
    const e = empById(id);
    if(!e) return;

    Object.assign(e, {name, position, dept, phone, email, initials:initialsOf(name)});
    saveAppData();
    showToast("Data karyawan diperbarui");
  } else {
    const usedIds=employees
      .map(e=>String(e.id||"").match(/^E(\d+)$/))
      .filter(Boolean)
      .map(m=>Number(m[1]));
    const nextNumber=usedIds.length ? Math.max(...usedIds)+1 : 1;
    const newId = "E"+String(nextNumber).padStart(2,'0');

    employees.push({
      id:newId,
      name,
      position,
      dept,
      phone,
      email,
      initials:initialsOf(name),
      join:new Date().toLocaleDateString("id-ID",{day:'numeric',month:'short',year:'numeric'}),
      base:5000000,
      allowance:500000,
      deduction:150000
    });

    saveAppData();
    showToast("Karyawan baru ditambahkan");
  }
  closeModal();
  if(admActiveTab==='karyawan') setAdmTab('karyawan');
}
function initialsOf(name){
  return name.split(" ").filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join("");
}
function confirmDeleteEmployee(id){
  const e = empById(id);
  openModal("Hapus Karyawan", `<p style="font-size:14px; margin:0;">Yakin ingin menghapus data <strong>${e.name}</strong> dari sistem? Tindakan ini tidak dapat dibatalkan.</p>`,
  `<div style="display:flex; gap:10px;">
    <button class="btn btn-soft" onclick="viewEmployeeDetail('${id}')">Batal</button>
    <button class="btn btn-red" onclick="deleteEmployee('${id}')">Hapus</button>
  </div>`);
}
function deleteEmployee(id){
  employees = employees.filter(e=>e.id!==id);

  // Keep all related records consistent with the employee database.
  attendance = attendance.filter(a=>a.empId!==id);
  leaves = leaves.filter(l=>l.empId!==id);

  saveAppData();
  deleteEmployeeFromDB(id);
  closeModal();
  showToast("Karyawan dihapus dari sistem");
  if(admActiveTab==='karyawan') setAdmTab('karyawan');
}

// ============================================================
// REKAP ABSENSI - HELPER PERHITUNGAN
// ============================================================
// Catatan asumsi: hari kerja dihitung Senin-Jumat (Sabtu/Minggu dianggap libur).
// Tidak ada aturan jam masuk baku yang tersimpan di aplikasi, sehingga rekap ini
// berfokus pada Hadir / Cuti Disetujui / Tidak Absen, bukan status terlambat.

function daysInMonth(year, month1based){
  return new Date(year, month1based, 0).getDate();
}

function workingDaysForEmployeeInMonth(e, year, month1based){
  const now = new Date();
  const isFuture = (year > now.getFullYear()) || (year === now.getFullYear() && month1based > now.getMonth()+1);
  if(isFuture) return 0;
  const isCurrent = (year === now.getFullYear() && month1based === now.getMonth()+1);
  const lastDay = isCurrent ? Math.min(now.getDate(), daysInMonth(year, month1based)) : daysInMonth(year, month1based);
  const join = e ? parseJoinDate(e.join) : null;
  const joinFloor = join ? new Date(join.getFullYear(), join.getMonth(), join.getDate()) : null;

  let count = 0;
  for(let d = 1; d <= lastDay; d++){
    const dt = new Date(year, month1based-1, d);
    if(joinFloor && dt < joinFloor) continue;
    const dow = dt.getDay();
    if(dow !== 0 && dow !== 6) count++;
  }
  return count;
}

function approvedLeaveDaysInMonth(empId, year, month1based){
  const monthStart = new Date(year, month1based-1, 1);
  const monthEnd = new Date(year, month1based-1, daysInMonth(year, month1based));
  let total = 0;
  leaves.filter(l => l.empId === empId && l.status === 'Disetujui').forEach(l => {
    const s = new Date(l.start+"T00:00:00");
    const en = new Date(l.end+"T00:00:00");
    const from = s > monthStart ? s : monthStart;
    const to = en < monthEnd ? en : monthEnd;
    if(from <= to) total += Math.round((to-from)/86400000) + 1;
  });
  return total;
}

function attendanceRecapForMonth(month, empFilter){
  const [y, mo] = month.split("-").map(Number);
  const monthAttendance = attendance.filter(a => a.date && a.date.startsWith(month));
  return employees
    .filter(e => empFilter === 'all' || e.id === empFilter)
    .map(e => {
      const hadir = monthAttendance.filter(a => a.empId === e.id).length;
      const lengkap = monthAttendance.filter(a => a.empId === e.id && a.checkOut).length;
      const cuti = approvedLeaveDaysInMonth(e.id, y, mo);
      const hariKerja = workingDaysForEmployeeInMonth(e, y, mo);
      const tidakHadir = Math.max(hariKerja - hadir - cuti, 0);
      return {emp:e, hadir, lengkap, cuti, hariKerja, tidakHadir};
    });
}

function selectAdminAttendanceMonth(month){
  if(!month) return;
  window.adminSelectedAttendanceMonth = month;
  setAdmTab("absensi");
}
function selectAdminAttendanceEmployee(empId){
  window.adminSelectedAttendanceEmp = empId || 'all';
  setAdmTab("absensi");
}

function renderAdmAbsensi(){
  const month = window.adminSelectedAttendanceMonth || currentMonthKey();
  const empFilter = window.adminSelectedAttendanceEmp || 'all';
  const recap = attendanceRecapForMonth(month, empFilter);

  const list = attendance
    .filter(a => a.date && a.date.startsWith(month) && (empFilter === 'all' || a.empId === empFilter))
    .slice().reverse();

  const totalHadirBulanIni = recap.reduce((s,r)=>s+r.hadir,0);
  const totalTidakHadir = recap.reduce((s,r)=>s+r.tidakHadir,0);

  return `
    <div class="grid2" style="margin-bottom:16px;">
      <div class="stat-box blue"><div class="num">${attendance.filter(a=>a.date===todayISO()).length}</div><div class="lbl">Hadir Hari Ini</div></div>
      <div class="stat-box"><div class="num">${employees.length - attendance.filter(a=>a.date===todayISO()).length}</div><div class="lbl">Belum Absen</div></div>
    </div>

    <div class="card">
      <label class="form-label">Bulan Rekap</label>
      <input id="admAttMonthPicker" class="form-input" type="month"
        value="${month}" onchange="selectAdminAttendanceMonth(this.value)">
      <label class="form-label" style="margin-top:12px;">Karyawan</label>
      <select id="admAttEmpPicker" class="form-input" onchange="selectAdminAttendanceEmployee(this.value)">
        <option value="all" ${empFilter==='all'?'selected':''}>Semua Karyawan</option>
        ${employees.map(e=>`<option value="${e.id}" ${empFilter===e.id?'selected':''}>${e.name}</option>`).join("")}
      </select>
    </div>

    <div class="grid2" style="margin-bottom:16px;">
      <div class="stat-box green"><div class="num">${totalHadirBulanIni}</div><div class="lbl">Total Hadir · ${monthLabel(month)}</div></div>
      <div class="stat-box red"><div class="num">${totalTidakHadir}</div><div class="lbl">Total Tidak Absen (estimasi)</div></div>
    </div>

    <p class="section-label">Ringkasan per Karyawan · ${monthLabel(month)}</p>
    ${recap.length===0 ? emptyState("📍","Belum ada karyawan","Tambahkan karyawan untuk melihat rekap") :
      recap.map(r=>`
        <div class="card">
          <div class="row" style="margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="li-avatar">${r.emp.initials}</div>
              <div><p class="li-title">${r.emp.name}</p><p class="li-sub">${r.emp.position}</p></div>
            </div>
          </div>
          <div class="slip-line"><span>Hari Kerja Berjalan</span><span style="font-weight:700;">${r.hariKerja} hari</span></div>
          <div class="slip-line"><span>Hadir</span><span style="font-weight:700;color:var(--green);">${r.hadir} hari</span></div>
          <div class="slip-line"><span>Absen Lengkap (masuk+pulang)</span><span style="font-weight:700;">${r.lengkap} hari</span></div>
          <div class="slip-line"><span>Cuti/Izin Disetujui</span><span style="font-weight:700;color:var(--blue);">${r.cuti} hari</span></div>
          <div class="slip-line total"><span>Tidak Absen (estimasi)</span><span style="font-weight:800;color:var(--red);">${r.tidakHadir} hari</span></div>
        </div>
      `).join("")
    }

    <div style="margin:14px 0 4px;">
      <button class="btn btn-navy" style="width:100%;" onclick="downloadAttendanceRecap('${month}','${empFilter}')">📝 Unduh Rekap Absensi (Word)</button>
    </div>

    <p class="section-label">Riwayat Absensi · ${monthLabel(month)}</p>
    ${list.length===0 ? emptyState("📍","Belum ada data absensi","Data akan muncul setelah karyawan melakukan absen") :
      list.map(a=>{
        const e = empById(a.empId);
        return `<div class="list-item" onclick="viewAttendanceDetail('${a.id}')">
          <div class="li-avatar">${e ? e.initials : '?'}</div>
          <div style="flex:1;"><p class="li-title">${e ? e.name : 'Karyawan'}</p><p class="li-sub">${formatDateID(a.date)} · Masuk ${a.checkIn}</p></div>
          <span class="badge ${a.checkOut?'green':'amber'}">${a.checkOut?'Lengkap':'Belum Pulang'}</span>
        </div>`;
      }).join("")
    }
  `;
}

// ============================================================
// DOWNLOAD REKAP ABSENSI (WORD)
// ============================================================
function downloadAttendanceRecap(month, empFilter){
  const recap = attendanceRecapForMonth(month, empFilter || 'all');
  if(recap.length===0){ showToast("Tidak ada data untuk diunduh."); return; }

  const row = (r) => `<tr>
    <td>${escapeWordHtml(r.emp.name)}</td>
    <td>${escapeWordHtml(r.emp.position)}</td>
    <td style="text-align:center;">${r.hariKerja}</td>
    <td style="text-align:center;">${r.hadir}</td>
    <td style="text-align:center;">${r.lengkap}</td>
    <td style="text-align:center;">${r.cuti}</td>
    <td style="text-align:center;">${r.tidakHadir}</td>
  </tr>`;

  const content = `
<html>
<head><meta charset="utf-8">
<title>Rekap Absensi - ${escapeWordHtml(monthLabel(month))}</title>
<style>
body{font-family:Arial,sans-serif;font-size:11pt;color:#222}
h1{text-align:center;font-size:18pt;margin-bottom:4px}
h2{text-align:center;font-size:12pt;font-weight:normal;margin-top:0}
table{width:100%;border-collapse:collapse;margin-top:18px}
td,th{border:1px solid #999;padding:8px;text-align:left}
th{background:#f2f2f2}
</style></head>
<body>
<h1>REKAP ABSENSI</h1>
<h2>${escapeWordHtml(monthLabel(month))}</h2>
<table>
<tr>
  <th>Nama</th><th>Jabatan</th><th>Hari Kerja</th><th>Hadir</th><th>Lengkap</th><th>Cuti/Izin</th><th>Tidak Absen</th>
</tr>
${recap.map(row).join("")}
</table>
<p style="margin-top:22px;font-size:9pt;color:#666">
Hari kerja dihitung Senin-Jumat, dibatasi sampai tanggal berjalan untuk bulan yang sedang berlangsung.
Kolom "Tidak Absen" merupakan estimasi (hari kerja dikurangi hadir dan cuti/izin disetujui).
Dokumen diterbitkan melalui Nadi HRIS.
</p>
</body></html>`;

  const blob = new Blob(["\ufeff", content], {type:"application/msword"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const suffix = (empFilter && empFilter !== 'all') ? (empById(empFilter)?.name || 'Karyawan') : 'Semua-Karyawan';
  a.download = `Rekap-Absensi-${suffix.replace(/[^a-z0-9]+/gi,"-")}-${month}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
function viewAttendanceDetail(id){
  const a = attendance.find(x=>x.id===id);
  const e = empById(a.empId);
  openModal("Detail Absensi", `
    <div class="card" style="background:var(--surface); border:none; margin-bottom:14px;">
      <p style="font-weight:800; margin:0;">${e ? e.name : '-'}</p>
      <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">${formatDateID(a.date)}</p>
    </div>
    <p style="font-size:12.5px; font-weight:700; color:var(--muted); margin-bottom:8px;">ABSEN MASUK</p>
    <div class="cam-box" style="aspect-ratio:16/10; margin-bottom:8px;">
      ${a.photoIn && a.photoIn!=='simulated' ? `<img src="${a.photoIn}">` : `<div class="cam-placeholder">📷 Foto absen tersimpan</div>`}
    </div>
    <div class="slip-line"><span>Waktu</span><span style="font-weight:700;">${a.checkIn}</span></div>
    <div class="slip-line"><span>Lokasi</span><span style="font-weight:700;">📍 ${a.locIn}</span></div>
    ${a.checkOut ? `
      <p style="font-size:12.5px; font-weight:700; color:var(--muted); margin:16px 0 8px;">ABSEN PULANG</p>
      <div class="cam-box" style="aspect-ratio:16/10; margin-bottom:8px;">
        ${a.photoOut && a.photoOut!=='simulated' ? `<img src="${a.photoOut}">` : `<div class="cam-placeholder">📷 Foto absen tersimpan</div>`}
      </div>
      <div class="slip-line"><span>Waktu</span><span style="font-weight:700;">${a.checkOut}</span></div>
      <div class="slip-line"><span>Lokasi</span><span style="font-weight:700;">📍 ${a.locOut}</span></div>
    ` : `<p style="font-size:12.5px; color:var(--amber); font-weight:600; margin-top:14px;">Karyawan belum melakukan absen pulang.</p>`}
  `);
}


// ============================================================
// ADMIN / EDIT TANGGAL BERGABUNG
// ============================================================
//
// Digunakan untuk karyawan lama yang sudah bekerja sebelum HRIS dibuat.
// Setelah tanggal bergabung diperbaiki, periode slip gaji otomatis mengikuti
// tanggal tersebut.
//

function openJoinDateEditor(empId) {
  const e = empById(empId);
  if (!e) return;

  const d = parseJoinDate(e.join);
  const currentValue = d
    ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
    : "";

  openModal(
    `Edit Tanggal Bergabung · ${e.name}`,
    `
      <div class="form-group">
        <label class="form-label">Tanggal Bergabung</label>
        <input
          id="editJoinDateInput"
          class="form-input"
          type="date"
          value="${currentValue}"
          max="${new Date().toISOString().slice(0,10)}"
        />
        <p class="form-help">
          Tanggal ini menjadi dasar tanggal gajian bulanan dan periode slip gaji.
        </p>
      </div>
    `,
    `
      <button class="btn btn-navy" type="button" onclick="saveJoinDate('${e.id}')">
        Simpan Tanggal
      </button>
    `
  );
}

function saveJoinDate(empId) {
  const input = document.getElementById("editJoinDateInput");
  const value = input ? input.value : "";

  if (!value) {
    showToast("Tanggal bergabung wajib diisi.");
    return;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime()) || date > new Date()) {
    showToast("Tanggal bergabung tidak valid.");
    return;
  }

  const employee = empById(empId);
  if (!employee) return;

  const monthNames = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  employee.join = `${day} ${monthNames[month-1]} ${year}`;

  // Persist employee data using the app's existing storage/state mechanism.
  saveAppData();

  if (typeof saveData === "function") {
    try { saveData(); } catch (err) {}
  }

  showToast("Tanggal bergabung berhasil diperbarui.");
  closeModal();

  if (typeof admActiveTab !== "undefined" && admActiveTab === "karyawan") {
    setAdmTab("karyawan");
  } else if (typeof admActiveTab !== "undefined" && admActiveTab === "penggajian") {
    setAdmTab("penggajian");
  }
}

function renderAdmPenggajian(){
  const selectedMonth=window.adminSelectedSalaryMonth||currentMonthKey();
  const total=employees.reduce((sum,e)=>{
    const join=parseJoinDate(e.join);
    if(!join)return sum;
    const [y,m]=selectedMonth.split("-").map(Number);
    const period=new Date(y,m-1,1);
    const joinMonth=new Date(join.getFullYear(),join.getMonth(),1);
    return period>=joinMonth ? sum+salaryForPeriod(e,selectedMonth) : sum;
  },0);

  return `
    <div class="hero-card">
      <p class="hero-greet">Penggajian Admin</p>
      <p class="hero-name" style="font-size:22px;">${rupiah(total)}</p>
    </div>

    <div class="card">
      <label class="form-label">Pilih Bulan Slip Gaji</label>
      <input id="adminSalaryMonthPicker" class="form-input" type="month"
        value="${selectedMonth}" onchange="selectAdminSalaryMonth(this.value)">
      <p class="form-help">Admin dapat memilih bulan sebelumnya, bulan berjalan, maupun bulan mendatang.</p>
    </div>

    <p class="section-label">Slip Gaji · ${monthLabel(selectedMonth)}</p>

    ${employees.map(e=>{
      const join=parseJoinDate(e.join);
      const [y,mn]=selectedMonth.split("-").map(Number);
      const periodStart=new Date(y,mn-1,1);
      const joinMonth=join?new Date(join.getFullYear(),join.getMonth(),1):null;
      const validPeriod=joinMonth&&periodStart>=joinMonth;
      const published=isSalaryPublished(e,selectedMonth);

      return `
        <div class="card">
          <div class="row" style="margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="li-avatar">${e.initials}</div>
              <div>
                <p class="li-title">${e.name}</p>
                <p class="li-sub">${e.position} · Bergabung ${e.join}</p>
              </div>
            </div>
          </div>

          <div class="slip-line">
            <span>Take-home Pay</span>
            <span style="font-weight:800;">${rupiah(validPeriod?salaryForPeriod(e,selectedMonth):0)}</span>
          </div>

          <p class="li-sub" style="margin:10px 0;">
            ${!validPeriod
              ? "⛔ Periode sebelum tanggal bergabung"
              : published
                ? "✅ Slip sudah diterbitkan"
                : "🕐 Belum diterbitkan"
            }
          </p>

          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${validPeriod
              ? `<button class="btn btn-outline btn-sm" style="flex:1;" onclick="openSalaryRuleForMonth('${e.id}','${selectedMonth}')">⚙️ Edit Slip</button>
                 <button class="btn btn-soft btn-sm" style="flex:1;" onclick="openJoinDateEditor('${e.id}')">📅 Edit Tanggal</button>
                 ${published
                   ? `<button class="btn btn-soft btn-sm" style="flex:1;" onclick="unpublishSalarySlip('${e.id}','${selectedMonth}')">↩ Batalkan</button>`
                   : `<button class="btn btn-navy btn-sm" style="flex:1;" onclick="publishSalarySlip('${e.id}','${selectedMonth}',true)">📄 Terbitkan</button>`
                 }
                 <button class="btn btn-soft btn-sm" style="width:100%;" onclick="viewSlipAdmin('${e.id}','${selectedMonth}')">👁 Lihat Slip</button>
                 <button class="btn btn-soft btn-sm" style="width:100%;" onclick="downloadSlipWord('${e.id}','${selectedMonth}')">📝 Download Word</button>`
              : `<button class="btn btn-soft btn-sm" style="width:100%;" disabled>Periode Tidak Berlaku</button>`
            }
          </div>
        </div>
      `;
    }).join("")}
  `;
}

function selectAdminSalaryMonth(month){
  if(!month)return;
  window.adminSelectedSalaryMonth=month;
  setAdmTab("penggajian");
}

// ============================================================
// PENGGAJIAN / SLIP GAJI
// ============================================================
function openSalaryRule(id){
  const e = empById(id);
  openModal("Aturan Gaji Karyawan", `
    <div class="card" style="background:var(--surface); border:none; margin-bottom:14px;">
      <p style="font-weight:800; margin:0;">${e.name}</p>
      <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">${e.position} · ${e.dept}</p>
    </div>
    <div class="field"><label>Gaji Pokok</label><input type="number" id="sBase" value="${e.base}"></div>
    <div class="field"><label>Tunjangan</label><input type="number" id="sAllow" value="${e.allowance}"></div>
    <div class="field"><label>Potongan (BPJS &amp; Pajak)</label><input type="number" id="sDeduct" value="${e.deduction}"></div>
    <p class="field-hint">Perubahan berlaku untuk perhitungan slip gaji periode berjalan.</p>
  `, `<button class="btn btn-navy" onclick="saveSalaryRule('${e.id}')">Simpan Aturan Gaji</button>`);
}
function saveSalaryRule(id){
  const e = empById(id);
  e.base = Number(document.getElementById('sBase').value) || 0;
  e.allowance = Number(document.getElementById('sAllow').value) || 0;
  e.deduction = Number(document.getElementById('sDeduct').value) || 0;
  closeModal();
  showToast("Aturan gaji diperbarui");
  if(admActiveTab==='penggajian') setAdmTab('penggajian');
}
function viewSlipAdmin(id,selectedMonth=null){
  const e=empById(id);
  if(!e)return;
  const month=selectedMonth||window.adminSelectedSalaryMonth||currentMonthKey();
  const join=parseJoinDate(e.join);
  const [y,mn]=month.split("-").map(Number);
  const period=new Date(y,mn-1,1);
  const joinMonth=join?new Date(join.getFullYear(),join.getMonth(),1):null;

  if(!joinMonth||period<joinMonth){
    showToast("Periode sebelum tanggal bergabung tidak tersedia.");
    return;
  }

  const published=isSalaryPublished(e,month);

  openModal(
    `Slip Gaji · ${e.name} · ${monthLabel(month)}`,
    buildSlipBody(e,month),
    `<div style="display:flex;gap:8px;flex-wrap:wrap;">
      ${published
        ? `<button class="btn btn-soft" onclick="unpublishSalarySlip('${e.id}','${month}')">↩ Batalkan Terbit</button>`
        : `<button class="btn btn-navy" onclick="publishSalarySlip('${e.id}','${month}',true)">📄 Terbitkan Slip</button>`
      }
      <button class="btn btn-soft" onclick="downloadSlipWord('${e.id}','${month}')">📝 Download Word</button>
    </div>`
  );
}

function renderAdmCuti(){
  const monthFilter = window.adminSelectedCutiMonth || 'all';
  const allMonths = Array.from(new Set(leaves.map(l=>String(l.start||'').slice(0,7)).filter(Boolean))).sort().reverse();
  const list = leaves
    .filter(l=> monthFilter==='all' || String(l.start||'').slice(0,7)===monthFilter)
    .slice().reverse();

  return `
    <div class="card">
      <label class="form-label">Filter Bulan Pengajuan</label>
      <select id="admCutiMonthPicker" class="form-input" onchange="selectAdminCutiMonth(this.value)">
        <option value="all" ${monthFilter==='all'?'selected':''}>Semua Bulan</option>
        ${allMonths.map(m=>`<option value="${m}" ${monthFilter===m?'selected':''}>${monthLabel(m)}</option>`).join("")}
      </select>
      <p class="form-help">Pilih bulan tertentu untuk melihat, atau mengosongkan, riwayat cuti bulan tersebut saja.</p>
    </div>

    <button class="btn btn-outline-red" style="width:100%; margin-bottom:16px;" ${list.length===0?'disabled':''}
      onclick="confirmClearLeaves('${monthFilter}')">
      🗑 Kosongkan ${monthFilter==='all' ? 'Semua Riwayat Cuti' : 'Riwayat Cuti ' + monthLabel(monthFilter)}
    </button>

    <p class="section-label">${monthFilter==='all' ? 'Semua Pengajuan Cuti' : 'Pengajuan Cuti · ' + monthLabel(monthFilter)}</p>
    ${list.length===0 ? emptyState("🗓️","Belum ada pengajuan cuti","Pengajuan dari karyawan akan muncul di sini, atau sudah dikosongkan untuk bulan ini") :
      list.map(l=>{
        const e = empById(l.empId);
        return `<div class="card">
          <div class="row" style="margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <div class="li-avatar">${e ? e.initials : '?'}</div>
              <div><p class="li-title">${e ? e.name : '-'}</p><p class="li-sub">${l.type}</p></div>
            </div>
            ${leaveBadge(l.status)}
          </div>
          <div class="slip-line"><span>Tanggal</span><span style="font-weight:700;">${formatDateID(l.start)} – ${formatDateID(l.end)}</span></div>
          <p style="font-size:12.5px; color:var(--muted); margin:8px 0 12px;">${l.reason}</p>
          <div style="display:flex; gap:8px;">
            ${l.status==='Menunggu' ? `
              <button class="btn btn-outline-red btn-sm" style="flex:1;" onclick="decideLeave('${l.id}','Ditolak')">Tolak</button>
              <button class="btn btn-navy btn-sm" style="flex:1;" onclick="decideLeave('${l.id}','Disetujui')">Setujui</button>
            ` : ``}
            <button class="btn btn-soft btn-sm" style="${l.status==='Menunggu' ? '' : 'flex:1;'}" onclick="confirmDeleteLeave('${l.id}')">🗑 Hapus</button>
          </div>
        </div>`;
      }).join("")
    }
  `;
}
function decideLeave(id, status){
  const l = leaves.find(x=>x.id===id);
  if(!l) return;

  l.status = status;
  saveAppData();
  showToast(status==='Disetujui' ? "Pengajuan cuti disetujui" : "Pengajuan cuti ditolak");
  setAdmTab('cuti');
}

function selectAdminCutiMonth(month){
  window.adminSelectedCutiMonth = month || 'all';
  setAdmTab('cuti');
}

function confirmDeleteLeave(id){
  const l = leaves.find(x=>x.id===id);
  if(!l) return;
  const e = empById(l.empId);
  openModal("Hapus Pengajuan Cuti", `
    <p style="font-size:14px; margin:0;">Yakin ingin menghapus pengajuan cuti <strong>${e ? e.name : '-'}</strong>
    (${formatDateID(l.start)} – ${formatDateID(l.end)})? Tindakan ini tidak dapat dibatalkan.</p>
  `, `
    <div style="display:flex; gap:10px;">
      <button class="btn btn-soft" onclick="closeModal()">Batal</button>
      <button class="btn btn-red" onclick="deleteLeaveRecord('${id}')">Hapus</button>
    </div>
  `);
}
function deleteLeaveRecord(id){
  leaves = leaves.filter(l=>l.id!==id);
  saveAppData();
  deleteLeaveFromDB(id);
  closeModal();
  showToast("Pengajuan cuti dihapus");
  if(admActiveTab==='cuti') setAdmTab('cuti');
}

function confirmClearLeaves(monthFilter){
  const targetIds = leaves
    .filter(l=> monthFilter==='all' || String(l.start||'').slice(0,7)===monthFilter)
    .map(l=>l.id);
  if(targetIds.length===0){ showToast("Tidak ada data cuti untuk dihapus."); return; }

  const label = monthFilter==='all' ? 'seluruh riwayat cuti' : `riwayat cuti bulan ${monthLabel(monthFilter)}`;
  openModal("Kosongkan Data Cuti", `
    <p style="font-size:14px; margin:0;">Yakin ingin menghapus ${label} (${targetIds.length} pengajuan)?
    Tindakan ini tidak dapat dibatalkan.</p>
  `, `
    <div style="display:flex; gap:10px;">
      <button class="btn btn-soft" onclick="closeModal()">Batal</button>
      <button class="btn btn-red" onclick="clearLeaves('${monthFilter}')">Ya, Kosongkan</button>
    </div>
  `);
}
function clearLeaves(monthFilter){
  const targetIds = leaves
    .filter(l=> monthFilter==='all' || String(l.start||'').slice(0,7)===monthFilter)
    .map(l=>l.id);
  leaves = leaves.filter(l=> !targetIds.includes(l.id));
  saveAppData();
  deleteLeavesFromDB(targetIds);
  closeModal();
  showToast("Data cuti dikosongkan");
  window.adminSelectedCutiMonth = 'all';
  setAdmTab('cuti');
}

/* ===================== CLOCK ===================== */
function tickClock(){
  const t = new Date().toLocaleTimeString("id-ID",{hour:'2-digit',minute:'2-digit'});
  const live = document.getElementById('liveClock');
  if(live) live.textContent = t;
}
setInterval(tickClock, 15000);



// Initial database boot. Login remains visible while data loads.
window.dataReady = loadAppData();
