# Nadi HRIS - Login & Payroll Final Fix

Perbaikan:
- Login Admin dan Karyawan diperbaiki agar berpindah layar dengan benar.
- `setAdmTab` dipastikan tersedia sebelum dashboard Admin dipanggil.
- `closeModal()` aman jika kamera belum pernah digunakan.
- Tombol Keluar Akun yang berada di luar profil dihapus.
- Keluar akun Admin hanya melalui Profil Admin kanan atas.
- Tampilan login tetap responsif dan terpusat untuk desktop, Android, iOS, portrait, landscape, serta safe-area.
- Status slip gaji karyawan sekarang benar-benar mengikuti penerbitan Admin. Bulan lampau tidak otomatis dianggap terbit.
- Admin dapat memilih bulan sebelumnya, berjalan, dan mendatang.
- Edit slip per bulan mencakup gaji pokok, tunjangan, lembur, bonus/insentif, pendapatan lain, BPJS, PPh 21/pajak, potongan lain, dan catatan.
- Total pendapatan, total potongan, dan total diterima dihitung otomatis.
- Slip Word mengikuti komponen payroll bulan yang dipilih.
- Tanggal bergabung tetap menjadi batas awal periode slip.
- Geofence: -7.447312, 109.253745; radius 100 meter.
\n\nFINAL UI FIX:\n- Tidak ada tombol Keluar Akun standalone di bagian atas/sidebar.\n- Keluar Akun hanya melalui Profil Admin kanan atas.\n- Login diposisikan tepat di tengah viewport menggunakan 100dvh + safe-area iOS/Android.\n

FINAL SLIP PUBLICATION FIX:

- Status slip karyawan sekarang murni berdasarkan status `published` yang disimpan Admin.
- Jika Admin menerbitkan slip secara manual, karyawan langsung dapat melihat dan membuka slip tersebut.
- Tidak lagi diblokir oleh tanggal gajian otomatis setelah Admin menerbitkannya.
- Jika belum diterbitkan, slip tetap terkunci dan tidak dapat dibuka.
- Status penerbitan diverifikasi kembali setelah disimpan ke localStorage.


FINAL LAYOUT FIX:

- Struktur `admApp` diperbaiki agar konten Admin dan bottom navigation tidak keluar dari container.
- Akibat bug struktur HTML sebelumnya, Penggajian Admin dan tabbar muncul di layar login. Ini sudah diperbaiki.
- Login sekarang benar-benar berada di tengah viewport secara vertikal dan horizontal.
- Responsive untuk desktop, Android, iOS, portrait, landscape, dan safe-area.
- Profil Admin tetap di kanan atas; Keluar Akun hanya ada di dalam dropdown profil.


PAYROLL BUTTONS FIX:

- Memperbaiki fungsi penyimpanan komponen payroll per karyawan + per bulan.
- Tombol Admin: Edit Slip, Lihat Slip, Terbitkan/Batalkan, dan Download Word berfungsi.
- Tombol Karyawan: Lihat Slip dan Download Word hanya aktif jika slip sudah diterbitkan Admin.
- Jika belum diterbitkan, slip terkunci dan tidak bisa dibuka/download.
- Nominal slip menggunakan data bulan yang dipilih, termasuk gaji pokok, tunjangan, lembur, bonus/insentif, pendapatan lain, BPJS, PPh 21/pajak, potongan lain, dan catatan.
- Data lama `netSalary` tetap didukung.


PERSISTENCE UPDATE:
- Data karyawan baru tetap tersimpan setelah refresh/reopen browser.
- Edit dan hapus karyawan juga tersimpan.
- Tanggal bergabung tersimpan.
- Data absensi tersimpan.
- Pengajuan dan keputusan cuti tersimpan.
- Data payroll per karyawan + bulan tetap tersimpan.
- Status penerbitan slip tetap tersimpan.
- ID karyawan, absensi, dan cuti tidak dibuat duplikat setelah data dihapus lalu ditambah.
- Penyimpanan menggunakan localStorage karena aplikasi masih berupa HTML/CSS/JS tanpa backend/database.
- Data pada perangkat/browser yang berbeda belum otomatis tersinkron; untuk penggunaan multi-perangkat/online diperlukan database/backend.


GPS / GEOFENCE UPDATE:
- Penyebab GPS lama sebelumnya: `enableHighAccuracy:true`, `maximumAge:0` dan timeout panjang memaksa browser mencari fix GPS baru.
- Sekarang lokasi dicari dalam 2 tahap: posisi cepat terlebih dahulu, lalu GPS akurasi tinggi hanya jika diperlukan.
- Timeout cepat: 3 detik; fallback GPS: maksimal 7 detik.
- Radius perusahaan: 100 meter dari -7.447312, 109.253745.
- Jika di luar radius, absensi ditolak.
- Jika izin lokasi ditolak/GPS tidak tersedia/timeout, absensi ditolak dan alasan ditampilkan.
- Tombol Konfirmasi Absen tetap terkunci sampai foto + lokasi perusahaan terverifikasi.
