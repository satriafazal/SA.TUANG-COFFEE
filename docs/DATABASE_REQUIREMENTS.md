# Database Requirements — SA.TUANG COFFEE

## 1. Tujuan

Dokumen ini menjadi acuan perancangan skema PostgreSQL 17 dan migrasi aplikasi. Ini adalah persyaratan konseptual, bukan migration/DDL yang sudah diterapkan. Implementasi skema baru dimulai setelah dokumen kebutuhan ditinjau dan disetujui.

## 2. Target

- DBMS: PostgreSQL 17.
- Database target lokal: `satuang_db`.
- Role koneksi lokal yang diminta: `postgres`.
- Kredensial koneksi tidak dicantumkan di dokumen atau source control. Simpan di file `.env` lokal yang diabaikan Git atau secret manager.
- Aplikasi harus mengakses database melalui konfigurasi environment; jangan menanam kredensial dalam kode.

## 3. Prinsip Perancangan

1. Sumber perubahan schema adalah migration berversi, dapat diulang pada lingkungan baru, dan dapat diuji.
2. Gunakan primary key internal stabil (UUID disarankan untuk identitas yang terekspos lintas sistem); nomor pesanan publik dibuat unik, sulit ditebak, dan terpisah dari primary key.
3. Gunakan foreign key, unique/check constraints, indeks, dan transaksi untuk menegakkan integritas.
4. Nilai uang memakai tipe fixed-precision (`numeric` dengan skala yang ditetapkan), bukan floating point.
5. Waktu tersimpan dalam `timestamptz`; tampilan mengikuti zona waktu gerai yang ditetapkan.
6. Simpan snapshot nama produk, harga satuan, pajak/komponen harga bila berlaku, diskon, dan total saat transaksi; perubahan katalog tidak mengubah bukti historis.
7. Status pembayaran, status order, status item, status refund, dan status pekerjaan cetak merupakan domain terpisah.
8. Data historis finansial dan loyalty tidak dihapus melalui CRUD normal; koreksi dibuat sebagai entri baru yang dapat diaudit.
9. Operasi checkout, konfirmasi pembayaran, reservasi/pembaruan stok, redeem poin, refund, dan pemberian poin harus aman terhadap request bersamaan dan kegagalan parsial.

## 4. Domain dan Entitas Kandidat

### Identitas dan akses
- `users`: akun Member dan staf, identitas login, status akun.
- `roles`, `permissions`, dan pivot role-permission/user-role atau model policy yang setara.
- Profil pelanggan dapat dipisah dari akun autentikasi agar Guest tetap didukung.

### Katalog dan ketersediaan
- `categories`, `products` (nama, deskripsi, harga aktif, jenis makanan/minuman, catatan diizinkan, status publikasi).
- Ketersediaan operasional terpisah atau atribut inventory/availability yang mendukung perubahan cepat oleh kasir.
- Riwayat perubahan stok/ketersediaan jika diperlukan untuk audit dan investigasi konflik.

### Paket, promosi, voucher
- `bundles` dan `bundle_components` untuk paket harga tetap; komponen menyimpan produk dan kuantitas.
- `promotions` dan aturan cakupan/syarat periode.
- `vouchers` serta catatan redemption/pembatasan kuota/pengguna bila voucher digunakan.
- Snapshot diskon yang diterapkan disimpan pada order/order item; perubahan aturan tidak mengubah order lama.

### Pesanan dan status
- `orders`: public order number unik, customer/member optional, nama pelanggan snapshot, status order, total, metode pemenuhan (pickup bila relevan), waktu.
- `order_items`: snapshot produk/harga/kuantitas/catatan dan referensi komponen bundle bila relevan.
- Status kesiapan disimpan pada tiap item pesanan, tetapi UI Kasir memperbarui seluruh item dengan `item_type` yang sama secara sekaligus; kelompok Makanan, Minuman, dan Lainnya tetap independen.
- `order_status_history` dan riwayat status item: status lama/baru, aktor, waktu, alasan opsional.
- Data status selesai harus dapat di-query cepat terpisah dari antrean aktif.

### Pembayaran dan refund
- `payments`: provider/metode, nominal, status, referensi eksternal, waktu penting.
- `payment_events`/webhook inbox: idempotency, payload tersaring, hasil verifikasi, timestamp; jangan menyimpan data sensitif yang tidak diperlukan.
- `refunds`: referensi pembayaran, nilai, status, alasan, aktor, referensi provider.
- Constraint/idempotency key untuk mencegah event provider atau request klien memproses pembayaran dua kali.

### Pencetakan
- `print_jobs`: tipe invoice/KOT, order, tujuan/printer, status, jumlah percobaan, error ringkas, waktu; pekerjaan cetak ulang adalah job baru yang terkait ke job asal/order, bukan order baru.

### Loyalty
- Konfigurasi berversi: aturan perolehan dan aturan penukaran dipisah, dengan status aktif/periode dan pembuat/perubah.
- `loyalty_ledger`: satu baris per earn, redeem, return, expiry, atau adjustment; immutable secara operasional; menyimpan signed delta/arah, poin, member, order terkait, aturan/snapshot, alasan, aktor, waktu, dan referensi transaksi asal untuk reversal.
- Saldo dapat dihitung dari ledger atau disimpan sebagai cache/summary yang diperbarui atomik dan dapat direkonsiliasi.
- Aturan yang dipakai saat transaksi harus disnapshot agar perubahan aturan hanya berlaku ke transaksi baru.
- Pemberian poin dikaitkan secara idempotent ke order selesai agar event status berulang tidak menggandakan poin.

### Pengaturan dan audit
- `store_settings`, banners, dan data toko sesuai ruang lingkup.
- `audit_logs` untuk perubahan sensitif; rahasia dan data pembayaran yang tidak diperlukan tidak dicatat.

## 5. Invarian Data Wajib

- Setiap order punya nomor publik unik dan minimal satu item.
- Total order sama dengan perhitungan item, biaya dan diskon yang tersimpan; nilai dihitung ulang server-side.
- Pembayaran berstatus sukses harus memiliki bukti konfirmasi internal yang sah (kasir untuk Cash atau provider untuk online).
- Status order `SIAP DIAMBIL` mensyaratkan semua item siap.
- Order `SELESAI` keluar dari query antrean aktif, tetapi tidak dihapus.
- Redeem poin tidak boleh menghasilkan saldo negatif dan harus atomik dengan checkout.
- Poin earn hanya sekali per order yang memenuhi syarat dan setelah status selesai.
- Refund/reversal menambah entri ledger baru; tidak menghapus entri awal.
- Penyesuaian poin mensyaratkan alasan dan identitas aktor berwenang.
- Kegagalan cetak tidak boleh menggandakan pembayaran/order.
- Ketersediaan divalidasi kembali saat checkout dan saat tahap operasional yang relevan.

## 6. Indeks dan Query Penting

Rancang indeks untuk:
- nomor order publik (unique), status dan waktu pembuatan untuk antrean aktif;
- pencarian order berdasarkan nomor dan nama (kebijakan pencarian disesuaikan privasi/performa);
- member dan waktu untuk riwayat order/ledger;
- provider reference/idempotency key unik untuk event pembayaran;
- status/tanggal print job;
- kategori/status publikasi produk.

Hindari indeks berlebihan sebelum query utama diuji. Validasi rencana query pada data uji realistis.

## 7. Transaksi dan Konkruensi

- Checkout mengunci/memvalidasi sumber harga dan ketersediaan secara konsisten saat order dibuat.
- Penerapan promo, redeem poin, pembayaran, serta order harus atomic atau memakai pola status/outbox yang menangani kegagalan.
- Webhook pembayaran harus idempotent dan tahan urutan event yang tidak beraturan.
- Pemberian poin saat status order selesai harus idempotent.
- Hindari double spend poin dengan row-level locking atau strategi konkurensi setara.
- Cetak sebaiknya dipicu melalui durable job/outbox agar kegagalan printer tidak membatalkan transaksi bisnis.

## 8. Keamanan, Backup, dan Operasional

- Batasi hak database aplikasi sesuai kebutuhan runtime; jangan menggunakan superuser `postgres` untuk koneksi aplikasi produksi.
- Role `postgres` yang diminta untuk setup lokal tidak berarti aplikasi produksi harus memakai superuser.
- Secret disimpan di luar Git; file `.env` harus diabaikan Git dan permission file dibatasi.
- Siapkan backup, uji restore, retensi, monitoring kapasitas, dan prosedur migrasi/rollback sebelum produksi.
- Masking/retensi log dan data pribadi ditentukan mengikuti kebijakan privasi.

## 9. Keputusan yang Belum Final

- UUID atau bigint internal; rekomendasi: UUID untuk identifier yang terekspos, boleh bigint internal jika tidak terekspos.
- Stok kuantitatif vs status tersedia/habis saja untuk MVP.
- Refund penuh/parsial dan bagaimana poin dipulihkan.
- Aturan retensi transaksi, audit, dan payment events.
- Multi-outlet atau satu gerai; jika multi-outlet, hampir semua domain katalog, stok, pesanan, printer, settings, dan aturan promosi perlu cakupan outlet.
- Nama tabel/status enum dan strategi migrasi ditentukan saat desain teknis disetujui.

## 10. Checklist Sebelum Implementasi

- [ ] PRD dan SRS ditinjau.
- [ ] Kebijakan promo, poin, refund, dan stok disepakati.
- [ ] Keputusan satu/multi-outlet disepakati.
- [ ] Diagram ERD dan transisi status ditinjau.
- [ ] Model ancaman, permission, privasi, dan audit disetujui.
- [ ] Strategi migrasi, seed development, backup, dan uji restore ditentukan.
- [ ] PostgreSQL 17 runtime lokal/deployment disiapkan dengan secret yang tidak masuk repo.
