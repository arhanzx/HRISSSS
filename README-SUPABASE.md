# Nadi HRIS + Supabase

## 1. Buat database
1. Buka Supabase Dashboard.
2. Masuk ke **SQL Editor**.
3. Jalankan seluruh isi `supabase.sql`.

## 2. Isi konfigurasi frontend
Salin `supabase-config.example.js` menjadi `supabase-config.js`, lalu isi:

```js
window.SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY"
};
```

URL dan key bisa diambil dari **Project Settings → API** (nama menu dapat berubah di dashboard Supabase).

## 3. Jalankan
Project ini tetap berupa HTML/CSS/JS biasa. Tidak perlu build step.

## 4. Vercel
- Framework Preset: **Other**
- Build Command: kosong
- Output Directory: `.`

Untuk project statis ini, `supabase-config.js` memang perlu ikut ke GitHub/Vercel. Isinya hanya URL project dan anon/publishable key. **Jangan pernah memasukkan service_role/secret key.**

## Catatan keamanan
Versi ini memakai kebijakan RLS prototype yang mengizinkan anon read/write supaya aplikasi demo vanilla JS dapat langsung bekerja. Untuk HRIS produksi, wajib migrasikan login ke **Supabase Auth** dan batasi RLS berdasarkan user/role. Password admin `admin123` yang ada di frontend juga hanya cocok untuk demo dan tidak aman untuk produksi.
