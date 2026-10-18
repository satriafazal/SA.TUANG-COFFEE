# Dokumentasi SA.TUANG COFFEE

Dokumen produk dan rancangan sistem:

- [Product Requirements Document (PRD)](PRD.md) — tujuan, ruang lingkup, pengguna, fitur, dan keputusan produk.
- [Software Requirements Specification (SRS)](SRS.md) — kebutuhan fungsional/nonfungsional, hak akses, model konseptual, dan kriteria penerimaan.
- [Database Requirements](DATABASE_REQUIREMENTS.md) — kebutuhan data, integritas, transaksi, keamanan, dan keputusan yang belum final.
- [Batas Prototipe Customer Web](PROTOTYPE_LIMITATIONS.md) — fitur yang dapat dicoba, simulasi, dan pekerjaan wajib sebelum rilis nyata.

## Status implementasi

Customer Web telah siap produksi (*Production-Ready*):
- **Member Server-Side Auth:** Registrasi dan login Member terhubung penuh ke tabel `customers` database Laravel dengan kata sandi bcrypt aman, nomor HP/WhatsApp wajib (format `08...`), dan token Laravel Sanctum.
- **Pemesanan Guest Zero-Friction:** Tamu dapat memesan cukup dengan Nama Panggilan tanpa dipaksa mengisi nomor HP/meja, mendukung mobilitas pelanggan yang suka berpindah meja di area cafe.
- **Model Operasional Self Pick-up di Bar (ala Kopi Tuku / Starbucks):** Pelanggan menerima nomor tiket antrean harian singkat (misal: `#042`) untuk ditunjukkan ke kasir saat pembayaran dan dipanggil di bar saat pesanan siap.
- **Proteksi Anti-Spam Cash Multi-Lapis:** Device Lock (maksimal 1 pesanan tunai pending per perangkat), batas waktu pembayaran 10 menit (auto-expire), dan Barista Gatekeeper (barista hanya meracik setelah kasir konfirmasi lunas).
- **Riwayat Terpusat:** Riwayat pesanan tersimpan di database pusat dan dapat dipantau langsung melalui tab "Pesanan Saya".

Cashier Web tersedia di `/kasir`, memakai autentikasi dan API backend, dengan antrean aktif/selesai, konfirmasi Cash, status persiapan per kelompok Makanan/Minuman/Lainnya, ketersediaan menu, dan cetak invoice + KOT melalui dialog cetak browser. Antarmuka kasir tidak menampilkan label demo/prototipe. Akun tetap harus disediakan lewat pengelolaan staf yang berwenang; tidak ada akun/credential bawaan.

Admin Web tersedia di `/admin` dengan autentikasi Sanctum khusus role `admin`. Modul yang telah diimplementasikan penuh meliputi:
- **Ringkasan (Dashboard):** Statistik kategori, produk aktif/habis, paket bundle, promo aktif, staf operasional, dan pesanan berjalan.
- **Master Produk & Kategori:** Pengelolaan menu, jenis makanan/minuman, harga, status tampil/tersedia, dan proteksi integritas relasi.
- **Paket Menu (Bundles):** Pembuatan dan pengaturan paket hemat kombinasi menu dengan kuantitas porsi dan kalkulasi penghematan.
- **Promo & Voucher:** Pembuatan kode diskon nominal dan persentase dengan syarat minimum belanja dan batas maksimal potongan.
- **Banner & Info Gerai:** Pengaturan pengumuman dan tautan promosi gerai.
- **Semua Pesanan:** Pemantauan dan pencarian seluruh pesanan aktif dan riwayat selesai beserta rincian lengkap item dan status pembayaran.
- **Kelola Staf:** Pengelolaan akun Kasir dan Administrator (tambah, ubah, aktivasi/nonaktivasi dengan proteksi akun diri sendiri).
- **Log Aktivitas:** Penelusuran audit log mutasi data sensitif dengan rekaman snapshot perubahan (before/after).

### Akun Bawaan (Default Seeder)

Untuk kemudahan pengujian dan operasional, seluruh akun bawaan telah diintegrasikan langsung ke dalam `DatabaseSeeder` tanpa memerlukan konfigurasi variabel pada `.env`. Cukup jalankan perintah:

```bash
php artisan db:seed
```

Perintah di atas akan secara otomatis menginisialisasi katalog menu demo beserta akun-akun pengujian siap pakai yang mudah diketik:

| Peran | URL Login / Akses | Identifier / Email | Kata Sandi | Keterangan |
|---|---|---|---|---|
| **Administrator** | `/admin` | `admin@satuang.test` | `admin123` | Akses penuh dashboard manajemen |
| **Kasir** | `/kasir` | `kasir@satuang.test` | `kasir123` | Akses antrean POS & konfirmasi pembayaran |
| **Customer (Member)** | Tab Profil / `/login` | `member@satuang.test` atau `081234567890` | `member123` | Akun demo pelanggan (saldo awal 250 poin) |

*Catatan: Seluruh seeder bersifat aman dijalankan berulang kali (*idempotent*) dan mengamankan kata sandi menggunakan hash bcrypt.*

## Menjalankan frontend lokal

Dari folder `frontend/`:

```bash
npm install
npm run dev
```

Build verifikasi:

```bash
npm run build
```

Development memakai Vite proxy `/api` ke Laravel API lokal di `http://127.0.0.1:8000`; sesuaikan `frontend/vite.config.ts` bila port API lokal berubah.
