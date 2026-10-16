# Dokumentasi SA.TUANG COFFEE

Dokumen produk dan rancangan sistem:

- [Product Requirements Document (PRD)](PRD.md) — tujuan, ruang lingkup, pengguna, fitur, dan keputusan produk.
- [Software Requirements Specification (SRS)](SRS.md) — kebutuhan fungsional/nonfungsional, hak akses, model konseptual, dan kriteria penerimaan.
- [Database Requirements](DATABASE_REQUIREMENTS.md) — kebutuhan data, integritas, transaksi, keamanan, dan keputusan yang belum final.
- [Batas Prototipe Customer Web](PROTOTYPE_LIMITATIONS.md) — fitur yang dapat dicoba, simulasi, dan pekerjaan wajib sebelum rilis nyata.

## Status implementasi

Customer Web sudah dibuat dan diuji pada browser; autentikasi Member, sesi Guest, poin, serta pemulihan nomor HP masih belum merupakan layanan produksi. Checkout Cash memanggil API backend; VA/QRIS belum diaktifkan.

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

### Menyiapkan akun Admin & Kasir pertama

Seeder membaca konfigurasi dari environment/secret manager secara privat (kata sandi minimal 12 karakter):

1. **Akun Admin:**
   Atur `ADMIN_SEED_NAME`, `ADMIN_SEED_EMAIL`, dan `ADMIN_SEED_PASSWORD`, lalu jalankan:
   ```bash
   php artisan db:seed --class='Database\Seeders\AdminUserSeeder'
   ```

2. **Akun Kasir:**
   Atur `CASHIER_SEED_NAME`, `CASHIER_SEED_EMAIL`, dan `CASHIER_SEED_PASSWORD`, lalu jalankan:
   ```bash
   php artisan db:seed --class='Database\Seeders\CashierUserSeeder'
   ```

Kedua seeder aman dijalankan ulang (idempotent), menyimpan hash kata sandi aman, tidak menampilkan credential, dan tidak mengubah akun yang sudah ada.

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
