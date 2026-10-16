# Software Requirements Specification (SRS)

## 1. Tujuan dan Konvensi

Dokumen ini mendefinisikan kebutuhan fungsional dan nonfungsional SA.TUANG COFFEE untuk menjadi acuan desain database, implementasi, pengujian, dan UAT. Istilah **HARUS** menunjukkan kebutuhan wajib MVP; **SEBAIKNYA** menunjukkan rekomendasi yang perlu dipertahankan kecuali disepakati lain.

## 2. Ruang Lingkup Sistem

Sistem terdiri dari Customer Web, Cashier Web, Admin/Marketing Web, REST API/backend, dan PostgreSQL 17. Barista/dapur tidak menggunakan aplikasi. Semua antarmuka HARUS responsif; pengalaman kasir dioptimalkan untuk tablet/ponsel dan admin untuk desktop dengan dukungan ponsel.

## 3. Aktor dan Hak Akses

| Aktor | Hak utama |
|---|---|
| Guest | Membaca katalog, membuat pesanan, melihat status dengan nomor pesanan dan nama sesuai kebijakan privasi. |
| Member | Hak Guest, akun, riwayat pesanan, saldo/riwayat poin, penukaran poin. |
| Kasir | Membaca antrean aktif dan detail, memvalidasi pembayaran tunai, mengonfirmasi pesanan berbayar, memperbarui status, ketersediaan, dan mengakses pesanan selesai. |
| Admin/Marketing | Mengelola master data, paket/promo/voucher, konten, staf, dan konfigurasi yang diizinkan. |
| Admin berwenang poin | Mengubah aturan poin dan membuat koreksi poin dengan alasan; hak ini tidak otomatis diberikan ke semua kasir. |
| Backend | Validasi, transaksi, otorisasi, pencatatan audit, pembayaran, poin, dan pekerjaan cetak. |

Akses harus ditolak secara default jika role/permission tidak memenuhi kebijakan.

## 4. Kebutuhan Fungsional

### 4.1 Autentikasi dan otorisasi
- **FR-AUTH-01** Landing page Customer Web bersifat informasional; tombol **Pesan Sekarang** membuka pilihan Member atau Guest. Memilih Guest harus menawarkan daftar Member atau melanjutkan tanpa akun.
- **FR-AUTH-02** Sistem HARUS mendukung registrasi dan autentikasi Member dengan email dan kata sandi.
- **FR-AUTH-03** Sesi Guest dan kode antrean adalah identitas yang berbeda. Sesi harus dapat mempertahankan riwayat Guest setelah refresh; untuk produksi gunakan sesi server-side melalui cookie `HttpOnly`, `Secure`, `SameSite`, bukan token tepercaya di `localStorage`.
- **FR-AUTH-04** Nomor HP Guest bersifat opsional. Helper “Mohon simpan kode antrean. Nomor HP dapat digunakan untuk memulihkan kode antrean.” selalu ditampilkan. Pemulihan produksi harus memverifikasi kepemilikan nomor (mis. OTP); nama dan jumlah item hanya petunjuk pencarian, bukan bukti.
- **FR-AUTH-05** Sistem HARUS mengautentikasi staf dan membatasi endpoint/UI sesuai role dan permission.
- **FR-AUTH-06** Aksi sensitif harus mencatat aktor dan waktu.

### 4.2 Katalog dan ketersediaan
- **FR-CAT-01** Pelanggan dapat melihat kategori, menu, harga, deskripsi/gambar, dan status tersedia.
- **FR-CAT-02** Sistem HARUS menolak item tidak tersedia saat validasi server-side.
- **FR-CAT-03** Perubahan ketersediaan oleh peran berwenang harus tercermin pada katalog.
- **FR-CAT-04** Katalog dan checkout HARUS bekerja pada viewport ponsel tanpa scroll horizontal.

### 4.3 Keranjang, checkout, dan pesanan
- **FR-ORD-01** Pelanggan dapat memilih item/jumlah dan catatan jika item mendukung catatan.
- **FR-ORD-02** Checkout HARUS memvalidasi ulang harga, ketersediaan, voucher/promo, dan poin di server.
- **FR-ORD-03** Setiap pesanan HARUS memiliki nomor unik, nama pelanggan, snapshot item/harga, subtotal, diskon, total, dan metode pembayaran.
- **FR-ORD-04** Data order HARUS menyimpan status pembayaran terpisah dari status pesanan.
- **FR-ORD-05** Sistem tidak menggunakan nomor atau lokasi meja.
- **FR-ORD-06** Sistem HARUS melindungi pembuatan pesanan dari pengiriman ulang yang menggandakan transaksi (idempotency atau kontrol setara).
- **FR-ORD-07** Pelanggan dapat membuka pelacakan tanpa sesi Guest dengan kode antrean dan nama yang cocok; data pesanan hanya dikembalikan jika kedua nilai cocok. Jika kode antrean hilang, pemulihan produksi harus membuktikan kepemilikan melalui mekanisme seperti OTP ke nomor HP.

### 4.4 Pembayaran
- **FR-PAY-01** Metode yang didukung kebutuhan produk adalah VA, QRIS, dan Cash.
- **FR-PAY-02** VA/QRIS tidak boleh dianggap berhasil berdasarkan bukti unggahan saja; harus ada konfirmasi provider yang tervalidasi.
- **FR-PAY-03** Kasir dapat mengonfirmasi Cash setelah pembayaran diterima.
- **FR-PAY-04** Pesanan berbayar yang ditolak/dibatalkan harus mengikuti proses refund; sistem harus menyimpan status dan referensinya.
- **FR-PAY-05** Integrasi gateway dianggap belum operasional sampai diuji dengan provider aktual.

### 4.5 Alur status pesanan dan item
- **FR-STATUS-01** Status utama MVP: `MENUNGGU PEMBAYARAN`, `PESANAN DITERIMA`, `SEDANG DIBUAT`, `SIAP DIAMBIL`, `SELESAI`.
- **FR-STATUS-02** Status pembayaran dikelola independen, minimal: `MENUNGGU`, `BERHASIL`, `GAGAL`, `KADALUWARSA`, `REFUND_SEBAGIAN`, `REFUND_PENUH` (pemetaan provider dapat berbeda).
- **FR-STATUS-03** Status kesiapan diperbarui per kelompok `Makanan`, `Minuman`, atau `Lainnya`; satu perubahan berlaku ke seluruh item dengan `item_type` yang sama, sementara kelompok lain tetap independen.
- **FR-STATUS-04** Status utama `SIAP DIAMBIL` hanya boleh dicapai ketika seluruh item dapat diserahkan/siap.
- **FR-STATUS-05** Perubahan status harus divalidasi terhadap transisi yang diizinkan dan dicatat dalam riwayat.
- **FR-STATUS-06** Kasir dapat melihat dan memfilter semua pesanan aktif, mencari berdasarkan nomor/nama, dan memperbarui status yang diizinkan.
- **FR-STATUS-07** Pesanan `SELESAI` harus dikecualikan dari antrean aktif dan tersedia dalam halaman riwayat yang dapat dicari.

### 4.6 Cetak invoice dan KOT
- **FR-PRINT-01** Setelah pesanan dibayar valid dan dikonfirmasi, sistem membuat pekerjaan invoice kasir dan KOT dapur/bar.
- **FR-PRINT-02** Invoice dan KOT memiliki konten/tujuan berbeda.
- **FR-PRINT-03** Status pekerjaan cetak dan kegagalan harus dicatat; cetak ulang tidak boleh membuat pesanan/pembayaran baru.
- **FR-PRINT-04** Integrasi printer dianggap belum operasional sampai diuji dengan perangkat target.

### 4.7 Paket, promo, dan voucher
- **FR-PROMO-01** Paket/bundle MVP terdiri dari komponen menu dan jumlah yang ditentukan, dengan harga paket.
- **FR-PROMO-02** KOT/order detail tetap menampilkan komponen paket agar persiapan dan stok dapat diproses.
- **FR-PROMO-03** Paket tidak tersedia bila komponen wajib tidak tersedia, sesuai aturan stok yang ditetapkan.
- **FR-PROMO-04** Promo/voucher MVP mendukung aturan sederhana yang eksplisit (jenis potongan, periode, syarat minimum dan cakupan).
- **FR-PROMO-05** Sistem harus menghitung diskon di server dan menyimpan snapshot aturan/perhitungan pada transaksi.
- **FR-PROMO-06** Batas kombinasi promo, voucher, dan poin harus dapat dikonfigurasi/ditetapkan secara eksplisit; aturan final merupakan keputusan bisnis terbuka.

### 4.8 Poin loyalitas
- **FR-LOY-01** Admin berwenang mengelola konfigurasi terpisah untuk Aturan Perolehan Poin dan Aturan Penukaran Poin.
- **FR-LOY-02** MVP memperoleh poin berdasarkan nominal belanja dan menukar poin menjadi potongan nominal.
- **FR-LOY-03** Poin hanya diberikan setelah pesanan Member berstatus `SELESAI` dan memenuhi syarat aturan.
- **FR-LOY-04** Setiap transaksi poin (perolehan, penukaran, pengembalian, kedaluwarsa, koreksi) harus dicatat sebagai ledger append-only; saldo dihitung dari ledger atau dijaga dengan mekanisme konsisten yang dapat direkonsiliasi.
- **FR-LOY-05** Riwayat transaksi menyimpan aturan/snapshot yang digunakan sehingga perubahan aturan tidak mengubah transaksi lama.
- **FR-LOY-06** Pembatalan/refund pesanan yang memakai poin mengembalikan poin sesuai kebijakan refund dan menghasilkan entri ledger, bukan menghapus transaksi.
- **FR-LOY-07** Koreksi saldo memerlukan alasan, aktor admin, waktu, dan entri koreksi baru.
- **FR-LOY-08** Hak mengubah aturan dan melakukan koreksi harus terpisah/terbatas dan diaudit.
- **FR-LOY-09** Persentase dan reward produk bukan kebutuhan MVP.

### 4.9 Admin dan audit
- **FR-ADM-01** Admin berwenang dapat mengelola kategori/menu, paket, promo/voucher, banner, informasi toko, dan akun staf sesuai permission.
- **FR-ADM-02** Data transaksi/riwayat pembayaran/poin tidak boleh dihapus melalui operasi bisnis normal.
- **FR-ADM-03** Aksi administratif sensitif harus mencatat pelaku, waktu, objek, dan perubahan yang relevan.
- **FR-ADM-04** Panel Admin pada `/admin` hanya dapat memakai API oleh staf aktif dengan role `admin`; dashboard menampilkan jumlah kategori/produk aktif, menu aktif yang tidak tersedia, pesanan berjalan, dan pesanan terbaru.
- **FR-ADM-05** Admin dapat membuat, membaca, mengubah, dan menghapus kategori; urutan, status aktif, dan deskripsi dapat dikelola. Kategori yang masih digunakan produk tidak boleh dihapus.
- **FR-ADM-06** Admin dapat membuat, membaca, mengubah, dan mengarsipkan produk, termasuk kategori, tipe, harga, deskripsi, gambar, catatan khusus, ketersediaan, dan status tampil.
- **FR-ADM-07** Pengarsipan produk tidak menghapus rekam historis pesanan; setiap mutasi kategori/produk harus membuat entri audit dengan identitas aktor dan snapshot perubahan.

## 5. Kebutuhan Nonfungsional

- **NFR-01 Responsif:** Customer dan kasir mobile-first; admin desktop-first namun responsif. Tidak ada konten/aksi inti yang memerlukan lebar desktop saja.
- **NFR-02 Usability:** Target sentuh minimum 44×44 CSS px, label jelas, status tidak dibedakan hanya melalui warna, validasi dekat dengan input.
- **NFR-03 Keamanan:** TLS di deployment, validasi server-side, hashing kata sandi via framework, perlindungan CSRF/session sesuai arsitektur, least privilege, secret melalui environment/secret manager dan tidak masuk repo.
- **NFR-04 Integritas:** Perhitungan total, penggunaan poin, konfirmasi pembayaran, dan perubahan stok kritis harus atomik/transaksional serta tahan terhadap request bersamaan.
- **NFR-05 Auditabilitas:** Perubahan status, pembayaran, aturan poin, ledger, refund, dan cetak dapat dilacak.
- **NFR-06 Ketersediaan/status:** UI menampilkan waktu/status terbaru; mekanisme polling atau WebSocket dipilih sesuai kebutuhan deployment.
- **NFR-07 Kompatibilitas:** Mendukung browser modern pada ponsel, tablet, dan desktop.
- **NFR-08 Pemeliharaan:** Logika pembayaran, order/status, stok, poin, dan printing dipisahkan dan dapat diuji.
- **NFR-09 Backup:** Database harus memiliki prosedur backup dan pemulihan yang terdokumentasi sebelum produksi.
- **NFR-10 Privasi:** Akses status order Guest harus membatasi paparan data pribadi dan tidak membocorkan rincian pesanan hanya dari nomor berurutan.

## 6. Model Data Konseptual Awal

Entitas kandidat: users, roles/permissions, customer_profiles, categories, products, product_availability/inventory, bundles, bundle_components, promotions, vouchers/redemptions, orders, order_items, payments/payment_events, order_status_history, item_status, print_jobs, loyalty_earning_rules, loyalty_redemption_rules, loyalty_ledger, refunds, audit_logs, store_settings/banners.

Kunci rancangan:
- Harga/nama item dan parameter diskon/poin yang relevan disimpan sebagai snapshot transaksi.
- Nomor order unik dan bukan ID internal berurutan yang terekspos.
- Pembayaran dan status order berbeda domain.
- Poin memakai ledger append-only dan referensi order/rule/aktor.
- Status per jenis item harus dapat merepresentasikan makanan dan minuman yang berbeda.
- Gunakan constraint, foreign key, indeks, dan transaksi PostgreSQL untuk menjaga integritas.

## 7. Kebutuhan Antarmuka Utama

- Customer: katalog, detail, keranjang, checkout, instruksi pembayaran, pelacakan, akun/riwayat/poin.
- Kasir: antrean aktif, filter/pencarian, detail pesanan, pembaruan status, ketersediaan, pembayaran, cetak, pesanan selesai.
- Admin: dashboard ringkas, CRUD master data, pengaturan promo/poin, staf/permission, dan audit.
- Kasir pada ponsel/tablet harus bisa melihat antrean multi-pesanan dan memindahkan pesanan selesai keluar dari daftar aktif.

## 8. Kebutuhan Operasional dan Deployment

- PostgreSQL versi target: 17.
- Nama database target: `satuang_db`; username koneksi lokal diminta `postgres`.
- Kredensial tidak boleh ditulis dalam dokumentasi, source control, atau contoh yang dapat dipublikasikan; gunakan `.env` lokal yang dikecualikan dari Git atau mekanisme secret yang sesuai.
- Provider pembayaran, perangkat printer, topologi jaringan, domain/hosting, dan strategi backup belum diputuskan.
- Migrasi harus menjadi sumber perubahan schema setelah implementasi dimulai; jangan mengandalkan perubahan manual tanpa migrasi.

## 9. Kriteria Penerimaan MVP

- Guest/Member dapat membuat pesanan unik dengan snapshot harga dan metode pembayaran.
- Pembayaran online tidak dianggap berhasil tanpa verifikasi yang sah.
- Kasir dapat melihat semua order aktif, mengubah status, dan menemukan order selesai terpisah.
- Status makanan/minuman dapat berbeda dan status utama siap hanya bila semua item siap.
- Ketersediaan divalidasi ulang dan sinkron dengan katalog.
- Invoice/KOT dapat dicoba ulang tanpa transaksi ganda; uji perangkat aktual menjadi acceptance integrasi.
- Admin dapat mengelola master data dan aturan poin dengan permission.
- Poin diberikan saat order selesai, dapat ditukar sebagai potongan nominal, dan seluruh event tercatat tanpa mengubah histori lama.
- Antarmuka inti dapat digunakan di ponsel/tablet tanpa scroll horizontal.
- Functional tests untuk alur inti lulus sebelum UAT.

## 10. Pertanyaan Terbuka yang Memblokir Keputusan Final

1. Provider VA/QRIS dan aturan webhook/rekonsiliasi.
2. Refund/pembatalan, termasuk refund parsial dan pengembalian poin.
3. Rasio perolehan, konversi poin ke rupiah, minimum/maksimum penukaran, masa berlaku, dan pembulatan.
4. Urutan/kombinasi diskon paket, promo, voucher, dan poin.
5. Aturan stok/overselling dan tindakan ketika item habis setelah pembayaran.
6. Model printer, koneksi, lokasi jaringan, dan cara cetak dari browser.
7. Outlet MVP ditetapkan satu lokasi: Banjar Wijaya; pemilik perlu mengonfirmasi alamat publik, jam operasional, dan kanal resmi.
8. Retensi data pribadi/transaksi dan mekanisme akses pelacakan Guest.
9. Detail akses kasir: apakah boleh menyesuaikan harga, membatalkan order, atau hanya mengubah ketersediaan/status.
10. Target deployment, domain, backup, monitoring, dan batas performa.
