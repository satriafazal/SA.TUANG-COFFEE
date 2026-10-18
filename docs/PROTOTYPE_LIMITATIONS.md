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

3. **5 Lapis Pengamanan Anti-Spam Cash:**
   - **Device Lock (Max 1 Pending Order):** Setiap perangkat tamu diidentifikasi dengan `guest_device_token`. Pelanggan tidak dapat membuat pesanan tunai baru jika masih memiliki pesanan `MENUNGGU_PEMBAYARAN` yang aktif.
   - **Auto-Expire 10 Menit:** Pesanan tunai yang tidak dibayar ke kasir dalam 10 menit otomatis hangus (`DIBATALKAN`) di server.
   - **Barista Gatekeeper:** Barista hanya menyeduh pesanan yang statusnya sudah dikonfirmasi LUNAS oleh kasir. Bahan baku 100% aman dari pesanan fiktif.
   - **Pencarian Tiket Kasir:** Kasir dapat mencari pesanan dengan cepat menggunakan nomor tiket 3-digit atau nama pelanggan.
   - **Rate Limiting:** Server membatasi percobaan akses dan pendaftaran akun dari IP yang sama.

4. **Penyimpanan Pesanan Terpusat:**
   - Endpoint `GET /api/v1/orders/my-orders` mengambil riwayat pesanan aktif dan selesai langsung dari database pusat berdasarkan `device_token` (untuk Guest) atau identitas akun Member.

---

## Status Fitur Saat Ini

| Bagian | Status Implementasi | Catatan Operasional |
|---|---|---|
| **Akun Member** | **Produksi (Real DB & Sanctum)** | Tabel `customers` di MySQL/PostgreSQL. Mendukung login dengan Email atau No. HP + Password min. 8 karakter. |
| **Sesi Guest & Anti-Spam** | **Produksi (Device Lock & Auto-Expire)** | Token perangkat anonim (`guest_device_token`), proteksi spam 1 pesanan pending, auto-expire 10 menit. |
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
