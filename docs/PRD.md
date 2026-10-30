# Product Requirements Document (PRD) — SA.TUANG COFFEE

## 1. Ringkasan Produk

**Nama Produk:** SA.TUANG COFFEE  
**Jenis:** Sistem pemesanan mandiri (*self-ordering*) dan operasional kedai kopi berbasis web responsif  
**Outlet Target:** SA.TUANG COFFEE Banjar Wijaya, Tangerang (Single Outlet MVP)  
**Tujuan Utama:** Memudahkan pelanggan memesan secara cepat dari ponsel (*zero-friction self pick-up*), membantu kasir mengelola antrean pesanan dan pembayaran tunai/QRIS secara efisien, serta menyediakan panel terpusat bagi admin untuk mengelola katalog hierarkis, paket, promo, staf, dan audit operasional.

Sistem terdiri dari tiga portal web utama:
1. **Customer Web (`/`):** Katalog menu dengan kategori hierarkis, pemesanan Guest & Member, pelacakan pesanan real-time, dan nomor tiket harian.
2. **Cashier Web (`/kasir`):** Antrean pesanan aktif, timer hitung mundur kedaluwarsa 10 menit, kontrol kesiapan per grup Makanan & Minuman, konfirmasi pembayaran kasir, dan arsip pesanan selesai.
3. **Admin Web (`/admin`):** Dashboard analitik, manajemen kategori 2-tingkat (Induk & Subkategori), produk, bundle paket, promo/voucher, banner, akun staf (RBAC), serta log audit mutasi data.

Barista/dapur bekerja langsung dari Kitchen Order Ticket (KOT) cetak dan layar antrean kasir tanpa diwajibkan mengakses aplikasi secara terpisah.

---

## 2. Masalah dan Peluang

* **Antrean Menumpuk di Meja Kasir:** Pelanggan sering menghabiskan waktu lama memilih menu di depan kasir. Solusi: Pelanggan dapat membuka katalog web dari meja atau antrean, memesan langsung, dan mendapatkan nomor tiket harian.
* **Risiko Pesanan Fiktif / Spam Kasir:** Pemesanan tunai via web rentan terhadap pesanan palsu. Solusi: Pembatasan perangkat (*device lock* max 1 pending order per device), pembatalan otomatis (*auto-expire*) dalam 10 menit, dan aturan bahwa barista hanya meracik pesanan yang telah dikonfirmasi LUNAS oleh kasir.
* **Struktur Menu yang Kompleks:** Menu kopi dan makanan membutuhkan pengelompokan yang jelas antara kategori induk (Minuman vs Makanan) dan subkategori spesifik (Espresso Based, Manual Brew, Rice Bowl, Pastry). Solusi: Sistem kategori berjenjang 2-tingkat.
* **Koordinasi Kesiapan Makanan dan Minuman:** Waktu pembuatan minuman dan makanan sering kali berbeda. Solusi: Pembaruan status kesiapan terpisah per grup kategori (Food & Drink) dengan eskalasi otomatis ke `SIAP_DIAMBIL` saat seluruh item siap.

---

## 3. Tujuan Produk

* **Pemesanan Mandiri Ramah Pengguna:** Pelanggan Guest dapat memesan hanya dengan nama panggilan (tanpa kewajiban login/nomor HP/nomor meja), menerima nomor tiket harian ringkas (misal: `#042`), dan memantau status pesanan secara real-time.
* **Akun Member & Loyalitas:** Pelanggan setia dapat mendaftar dengan nomor WhatsApp dan email untuk mengumpulkan poin loyalitas dari setiap transaksi selesai.
* **Operasional Kasir Terpadu:** Kasir dapat mencari pesanan dengan cepat melalui nomor tiket 3-digit atau nama, memvalidasi uang tunai/QRIS statis, memperbarui kesiapan grup, dan mencetak nota.
* **Kedaluwarsa Pesanan Otomatis:** Pesanan tunai yang tidak dibayar dalam 10 menit otomatis dibatalkan oleh sistem untuk menjaga akurasi antrean.
* **Integritas & Keamanan Master Data:** Pengelolaan katalog berjenjang, pencegahan siklus kategori, upload gambar dengan verifikasi MIME, proteksi anti-SSRF, rate limiting API, serta audit trail untuk setiap aksi sensitif staf.

---

## 4. Bukan Tujuan MVP (Out of Scope)

* Aplikasi tablet/web terpisah khusus untuk barista/dapur (barista menggunakan tiket KOT fisik).
* Integrasi payment gateway otomatis pihak ketiga (Midtrans/Xendit) live; MVP menggunakan metode Cash di Kasir & QRIS statis di meja kasir. Metode non-cash otomatis diblokir dengan aman sampai kredensial gateway dikonfigurasi.
* Integrasi driver printer thermal langsung tingkat sistem operasi (cetak nota dan KOT menggunakan dialog cetak bawaan browser standar 80mm/72mm).
* Pemilihan multi-cabang (sistem difokuskan penuh untuk outlet Banjar Wijaya).
* Penukaran poin kompleks berupa persentase diskon atau klaim reward produk fisik bertingkat pada fase MVP.

---

## 5. Persona Pengguna

### 5.1 Pelanggan Guest (Tamu)
* Ingin melihat menu dan memesan secepat mungkin tanpa proses registrasi yang berbelit.
* Cukup memasukkan nama pemesan dan memilih item menu.
* Menerima Nomor Tiket Harian (misal: `#015`) dan Nomor Pesanan Publik (misal: `ST-261030-ABCDEF`).
* Menggunakan tiket untuk konfirmasi pembayaran di meja kasir dan pelacakan pesanan.

### 5.2 Member (Pelanggan Terdaftar)
* Memiliki seluruh kemampuan Guest ditambah akses akun pribadi via Nomor WhatsApp (format `08...`) atau Email.
* Memiliki saldo poin loyalitas yang bertambah secara otomatis setiap pesanan diselesaikan.
* Dapat melihat riwayat seluruh pesanan sebelumnya secara terpusat.

### 5.3 Kasir (Operasional Outlet)
* Mengoperasikan tablet atau laptop di counter kasir dengan antarmuka cepat dan kontras tinggi.
* Memantau antrean pesanan aktif yang dilengkapi hitung mundur batas waktu pembayaran 10 menit.
* Mencari pesanan via nomor tiket 3-digit, nomor order, atau nama pemesan.
* Mengonfirmasi penerimaan pembayaran tunai, memicu pencetakan KOT/Invoice, dan mengubah kesiapan grup Food/Drink.
* Mengubah status ketersediaan menu (tersedia vs habis) secara real-time jika bahan baku menipis.

### 5.4 Admin & Manajer
* Mengakses panel administrasi desktop/ponsel dengan tampilan yang seragam dan elegan.
* Mengelola hierarki kategori 2-tingkat, data produk, harga, foto, paket bundle, promo/voucher, dan banner promosi.
* Mengelola akun staf (Kasir & Admin), hak akses, dan meninjau rekam jejak audit (*audit logs*).

---

## 6. Ruang Lingkup & Spesifikasi Fitur

### 6.1 Customer Web (`/`)
* **Landing Page & Pilihan Identitas:** Halaman pembuka informasional outlet Banjar Wijaya dengan tombol aksi cepat menuju katalog.
* **Pilihan Masuk Guest vs Member:** Modal penawaran keuntungan member tanpa memblokir pelanggan tamu yang ingin langsung memesan.
* **Katalog Menu Berjenjang (2-Tier Category Tabs):**
  - Tab kategori induk (Minuman, Makanan, Bundle Paket, Promo).
  - Subkategori filter dinamis (contoh pada Minuman: Kopi Susu, Manual Brew, Non-Coffee, Tea Series).
  - Pencarian menu instan berdasarkan nama dan deskripsi.
* **Keranjang & Catatan Khusus:** Modifikasi kuantitas, catatan khusus per menu (jika produk mengizinkan catatan), dan kalkulasi subtotal instan.
* **Checkout Cepat & Anti-Spam:**
  - Validasi harga dan ketersediaan menu di sisi server (*server-calculated total*).
  - Proteksi *device lock*: Pelanggan dibatasi maksimal 1 pesanan tunai aktif dalam status menunggu pembayaran.
  - Dukungan kode promo / voucher dengan validasi batas masa berlaku dan minimal belanja.
* **Pelacakan Pesanan (Order Tracking):**
  - Halaman pelacakan status pesanan real-time.
  - Verifikasi ganda anti-IDOR: Memerlukan nomor pesanan dan nama pemesan yang cocok.
  - Tombol konfirmasi mandiri "Pesanan Sudah Diambil" yang hanya aktif saat status pesanan `SIAP_DIAMBIL` dan diverifikasi via token perangkat/sesi member.

### 6.2 Cashier Web (`/kasir`)
* **Antarmuka Operasional Minimalis:** Desain responsif berorientasi sentuhan dengan tema khusus operasional kasir.
* **Antrean Pesanan Aktif & Hitung Mundur:**
  - Daftar pesanan aktif yang belum selesai.
  - Visual countdown timer 10 menit untuk pembayaran tunai yang belum dikonfirmasi.
  - Pembersihan otomatis (*auto-cancel*) pesanan kedaluwarsa setelah melewati 10 menit.
* **Pencarian Cepat:** Input pencarian responsif untuk nomor tiket harian (`#001`), nomor order (`ST-...`), atau nama pelanggan.
* **Konfirmasi Pembayaran Kasir:**
  - Aksi konfirmasi uang tunai yang idempotent (tidak dapat dikonfirmasi ganda).
  - Pemicu pembuatan antrean cetak KOT (dapur/bar) dan Invoice (pelanggan).
  - Penambahan poin loyalitas otomatis ke akun member terkait.
* **Grup Kesiapan Makanan & Minuman (Preparation Groups):**
  - Pemisahan item makanan dan minuman dalam satu pesanan.
  - Tombol aksi `DIPROSES` dan `SIAP` per grup kategori.
  - Eskalasi otomatis: Begitu seluruh grup kesiapan berstatus `SIAP`, status pesanan secara otomatis naik menjadi `SIAP_DIAMBIL`.
* **Ketersediaan Produk Kasir:** Toggle instan ketersediaan produk dan bundle menu dari meja kasir saat stok habis.
* **Riwayat Pesanan Selesai:** Tab terpisah khusus pesanan yang telah selesai (`SELESAI`) atau dibatalkan untuk keperluan pelaporan dan audit kasir.

### 6.3 Admin Web (`/admin`)
* **Tampilan Login Terstandarisasi:** Antarmuka login admin yang seragam dalam struktur, tipografi, warna, dan kontrol dengan login kasir.
* **Dashboard Ringkasan:** Statistik jumlah kategori aktif, produk tersedia/habis, pesanan aktif berjalan, dan transaksi terbaru.
* **Manajemen Kategori Hierarkis:**
  - Pembuatan kategori induk (Level 1) dan subkategori (Level 2).
  - Pewarisan tipe grup item (`drink` atau `food`).
  - Pencegahan referensi melingkar (*circular reference prevention*).
  - Proteksi penghapusan: Kategori yang memiliki produk atau subkategori tidak dapat dihapus sebelum dikosongkan.
* **Manajemen Produk & Upload Gambar Aman:**
  - CRUD produk dengan harga desimal tervalidasi (`min:0`).
  - Pengelompokan kategori menggunakan `<optgroup>` (Kategori Induk > Subkategori).
  - Upload file gambar dengan verifikasi ekstensi asli dari tipe MIME yang sah.
  - Import gambar dari URL eksternal yang terlindungi dari serangan SSRF (*blocking private/loopback/cloud metadata IP*).
* **Manajemen Paket Menu (Bundles):**
  - Pembuatan paket kombo dengan sinkronisasi relasi produk jamak dan kuantitas per komponen.
  - Validasi ketersediaan otomatis: Jika salah satu komponen habis, paket ditandai tidak tersedia.
* **Manajemen Promo & Banner:**
  - Kode voucher unik, tipe potongan (persentase max 100% atau nominal tetap), syarat minimal belanja, dan batas maksimal diskon.
  - Banner promosi carosel beranda.
* **Manajemen Staf & Hak Akses (RBAC):**
  - Akun staf kasir dan admin dengan kata sandi kuat (minimal 12 karakter).
  - Proteksi akun mandiri: Admin tidak dapat mendemosikan atau menonaktifkan akunnya sendiri.
* **Pusat Log Audit:** Pencatatan otomatis setiap aksi mutasi admin lengkap dengan snapshot sebelum/sesudah, alamat IP, waktu, dan identitas pelaku.

---

## 7. Alur Utama Sistem (End-to-End Workflow)

```
[ Pelanggan di HP ]
       │
       ▼
1. Buka Menu (Kategori Hierarkis Food & Drink)
       │
       ▼
2. Checkout (Guest isi nama / Member login HP)
       │
       ├──> Sistem terbitkan Tiket Harian (#042) & Kunci Token Device
       └──> Timer 10 Menit Mulai Berjalan
       │
       ▼
3. Pelanggan Datang ke Kasir & Bayar Cash/QRIS
       │
       ▼
[ Kasir di Counter ]
       │
       ├──> Cari Tiket #042 -> Klik "Konfirmasi Pembayaran"
       ├──> Nota Invoice & KOT Terbit
       └──> Pesanan Masuk Status "PESANAN DITERIMA"
       │
       ▼
[ Barista & Dapur ]
       │
       ├──> Racik Makanan / Seduh Kopi berdasarkan KOT
       └──> Beri tahu kasir saat salah satu/semua siap
       │
       ▼
[ Kasir Update Grup ]
       │
       ├──> Klik "Siap" pada Grup Minuman -> Status: SEDANG_DIBUAT
       ├──> Klik "Siap" pada Grup Makanan
       └──> SISTEM OTOMATIS UBAH STATUS KE: "SIAP DIAMBIL"
       │
       ▼
4. Pelanggan Ambil Pesanan di Bar
       │
       ├──> Kasir serahkan & klik "Selesai", ATAU
       └──> Pelanggan konfirmasi "Pesanan Diambil" di HP (Verifikasi Token/Sesi)
       │
       ▼
5. Order Berstatus "SELESAI"
       │
       ├──> Masuk ke Tab Riwayat Kasir
       └──> Poin Loyalitas Bertambah ke Akun Member
```

---

## 8. Status Kesiapan Produksi Saat Ini

* **Backend Test Suite:** 48 Feature & Unit Tests Lulus 100% (`php artisan test`).
* **Frontend TypeScript Build:** 0 type errors, lulus build produksi Vite (`tsc -b && vite build`).
* **Keamanan API:** Dilengkapi rate limiter (`throttle`), anti-SSRF DNS filter, anti-IDOR verification, dan prepared SQL statements.
* **Kesiapan Operasional:** Siap digunakan untuk operasional harian kedai SA.TUANG COFFEE Banjar Wijaya.
