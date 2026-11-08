# Batas Prototipe & Status Produksi Customer Web

Dokumen ini mencatat perkembangan sistem Customer Web SA.TUANG COFFEE dari tahap prototipe (*client-side mock*) menuju tahap **Production-Ready (Database Pusat & Autentikasi Server)**.

---

## Perkembangan Arsitektur Produksi (Terbaru)

Sistem Customer Web telah ditingkatkan dari ketergantungan `localStorage / prototypeState` menuju arsitektur server nyata:

1. **Autentikasi Member Nyata (Server-Side Auth):**
   - Registrasi dan login Member kini 100% diproses oleh backend Laravel dengan tabel `customers`.
   - Menggunakan hashing kata sandi aman (`bcrypt`), validasi email unik, nomor HP/WhatsApp wajib (format `08...`), dan penerbitan token sesi `Laravel Sanctum`.
   - Fitur hashing lokal Web Crypto di browser dan data demo di `prototypeState` telah dipensiunkan.

2. **Alur Pemesanan Guest Tanpa Ribet (Zero-Friction Self Pick-up):**
   - Pelanggan tamu (*Guest*) dapat langsung memesan cukup dengan mengisi **Nama Pemesan / Panggilan** tanpa dipaksa mengisi nomor HP atau nomor meja.
   - Sesuai model operasional **Self Pick-up di Bar (ala Kopi Tuku / Starbucks)**, pelanggan menerima **Nomor Tiket Harian Singkat** (contoh: **#042**) untuk ditunjukkan ke kasir saat pembayaran.

3. **6 Lapis Pengamanan Anti-Spam & Siklus Sesi Harian:**
   - **Device Lock (Max 1 Pending Order):** Setiap perangkat tamu diidentifikasi dengan `guest_device_token`. Pelanggan tidak dapat membuat pesanan tunai baru jika masih memiliki pesanan `MENUNGGU_PEMBAYARAN` yang aktif pada hari yang sama.
   - **Midnight Reset (00:00) & Daily Scoping:** Masa berlaku token perangkat tamu dan keranjang lokal otomatis di-reset saat berganti tanggal (pukul 00:00). Endpoint `my-orders` untuk tamu dibatasi khusus hari ini (`whereDate('created_at', today())`) agar status pesanan dari hari kemarin tidak pernah "nyangkut" di perangkat pelanggan.
   - **Auto-Expire 10 Menit & Auto-Cancel:** Pesanan tunai yang tidak dibayar ke kasir dalam 10 menit otomatis hangus (`DIBATALKAN`) di server dan tidak lagi memblokir pemesanan baru.
   - **Barista & Kasir Gatekeeper:** Barista dan kasir hanya memproses pesanan yang statusnya sudah LUNAS (dikonfirmasi kasir untuk Cash, atau diverifikasi otomatis oleh Midtrans untuk Online). Pesanan online yang belum dibayar tidak dimunculkan di antrean kasir untuk mencegah antrean semu dan pemborosan bahan baku (*food waste*).
   - **Pencarian Tiket Kasir:** Kasir dapat mencari pesanan dengan cepat menggunakan nomor tiket 3-digit atau nama pelanggan.
   - **Rate Limiting:** Server membatasi percobaan akses dan pendaftaran akun dari IP yang sama.

4. **Penyimpanan Pesanan Terpusat & Reset Mandiri:**
   - Endpoint `GET /api/v1/orders/my-orders` mengambil riwayat pesanan aktif dan selesai langsung dari database pusat berdasarkan `device_token` (untuk Guest, terbatas hari ini) atau identitas akun Member.
   - Disediakan tombol **"Sesi Baru"** pada antarmuka pelanggan tamu untuk mereset sesi seketika setelah seluruh pesanan selesai/batal.

---

## Status Fitur Saat Ini

| Bagian | Status Implementasi | Catatan Operasional |
|---|---|---|
| **Akun Member** | **Produksi (Real DB & Sanctum)** | Tabel `customers` di MySQL/PostgreSQL. Mendukung login dengan Email atau No. HP + Password min. 8 karakter. |
| **Sesi Guest & Anti-Spam** | **Produksi (Device Lock, Auto-Expire, & Midnight Reset)** | Token perangkat harian (`guest_device_token`), reset otomatis tiap 00:00, isolasi antrean hari ini, proteksi 1 pending order, dan tombol Sesi Baru. |
| **Nomor Tiket Antrean** | **Produksi (`daily_ticket_number`)** | Nomor antrean harian singkat (misal `#001`, `#002`) yang di-reset setiap hari untuk panggilan bar. |
| **Riwayat Pesanan** | **Produksi (`my-orders`)** | Terhubung langsung ke database pusat Laravel via API. |
| **Poin Loyalitas** | **Dasar (Tersimpan di DB)** | Poin bertambah otomatis saat kasir mengonfirmasi pembayaran. Aturan penukaran reward menunggu konfigurasi lanjutan. |
| **Metode Pembayaran** | **Cash di Kasir (Siap)** | Pelanggan bayar Tunai atau QRIS statis di meja kasir. Integrasi payment gateway otomatis (Midtrans/Xendit) dapat ditambahkan saat dibutuhkan. |
| **Cetak Nota / KOT** | **Browser Print Ready** | Kasir mencetak struk invoice dan KOT dapur via dialog cetak browser (standar printer thermal 80mm/72mm). |

---

## Rekomendasi Sebelum Peluncuran Publik (Go-Live)

1. Jalankan `php artisan storage:link` di server agar gambar produk dan banner terhubung.
2. Atur konfigurasi `.env` ke `APP_ENV=production` dan `APP_DEBUG=false`.
3. Ganti kata sandi akun bawaan seeder admin (`admin@satuang.test`) dan kasir (`kasir@satuang.test`) dengan kata sandi produksi yang aman.
4. Buat cron job / background worker di server untuk menjalankan pembersihan order berkala (`php artisan schedule:run`).
