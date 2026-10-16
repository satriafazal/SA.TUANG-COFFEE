# Product Requirements Document (PRD)

## 1. Ringkasan Produk

**Nama:** SA.TUANG COFFEE  
**Jenis:** Sistem pemesanan dan operasional kedai kopi berbasis web  
**Tujuan:** Memudahkan pelanggan memesan dari ponsel serta membantu kasir dan admin mengelola pesanan dan data operasional secara terpusat. MVP ini digunakan untuk satu outlet: SA.TUANG COFFEE Banjar Wijaya, bukan pemilih multi-cabang.

Sistem memiliki tiga area: Customer Web, Cashier Web, dan Admin/Marketing Web. Barista/dapur bekerja dari Kitchen Order Ticket (KOT) cetak dan berkoordinasi dengan kasir; mereka tidak diwajibkan menggunakan aplikasi.

## 2. Masalah dan Peluang

Pemesanan, validasi pembayaran, komunikasi kesiapan pesanan, ketersediaan menu, promosi, dan loyalitas perlu dikelola dengan alur yang konsisten. Antarmuka harus mudah digunakan di ponsel, khususnya oleh pelanggan dan kasir, tanpa mengorbankan efisiensi pengelolaan admin di layar besar.

## 3. Tujuan Produk

- Pelanggan dapat menemukan menu, membuat pesanan, membayar, dan memantau status melalui web responsif.
- Kasir dapat melihat antrean aktif, mencari pesanan, memvalidasi pembayaran, mengubah status, dan mengelola ketersediaan.
- Pesanan selesai dipisahkan dari antrean aktif dan tetap dapat dicari sebagai riwayat.
- Admin/marketing dapat mengelola master data dan aturan program loyalitas.
- Pembayaran online hanya dianggap berhasil setelah dikonfirmasi secara sah oleh penyedia pembayaran.
- Riwayat transaksi dan poin dapat diaudit.

## 4. Bukan Tujuan MVP

- Aplikasi web terpisah untuk barista/dapur.
- Integrasi pembayaran live sebelum provider dipilih dan dikonfigurasi.
- Integrasi perangkat printer langsung sebelum model, jaringan, dan mekanisme cetak dipastikan. Untuk Web Kasir, invoice dan KOT dapat dicetak melalui dialog cetak browser; integrasi perangkat langsung dapat menyusul.
- Penukaran poin berbentuk persentase atau reward produk pada MVP.
- Promo otomatis kompleks dengan kombinasi aturan bertingkat.
- Manajemen banyak outlet, kecuali kemudian dikonfirmasi sebagai kebutuhan.

## 5. Persona dan Kebutuhan

### 5.1 Pelanggan Guest
Ingin melihat menu dan memesan dengan langkah sedikit tanpa membuat akun. Mengidentifikasi pesanan menggunakan nomor pesanan dan nama.

### 5.2 Member
Memerlukan seluruh kemampuan Guest ditambah akun, riwayat pesanan, saldo/riwayat poin, dan penggunaan poin sesuai aturan aktif.

### 5.3 Kasir
Bekerja terutama melalui tablet/ponsel di counter. Perlu melihat semua pesanan aktif, menemukan pesanan baru, memvalidasi pembayaran, memperbarui kesiapan per kelompok kategori Makanan/Minuman/Lainnya (satu aksi untuk semua item dalam kelompok), dan menandai pesanan selesai. Pesanan selesai harus keluar dari antrean aktif.

### 5.4 Admin/Marketing
Menggunakan laptop/desktop untuk mengelola menu, kategori, paket, promo/voucher, banner, informasi toko, akun/hak akses staf, dan konfigurasi poin. Antarmuka tetap dapat digunakan di ponsel.

### 5.5 Barista/Dapur
Menerima KOT cetak, menyiapkan item, dan memberi informasi kesiapan atau stok habis kepada kasir; tidak mengakses sistem.

## 6. Ruang Lingkup Fitur

### Customer Web
- Landing page informasional untuk SA.TUANG COFFEE Banjar Wijaya; tombol **Pesan Sekarang** membuka pilihan Member atau Guest, bukan langsung memasukkan menu ke keranjang.
- Member dapat masuk/daftar menggunakan email dan kata sandi; Guest yang dipilih ditawari daftar Member atau lanjut tanpa akun.
- Guest memiliki sesi untuk menjaga riwayat saat refresh; kode antrean adalah nomor berbeda dari token/sesi. Nomor HP opsional dan helper recovery tampil selalu. Pemulihan nyata harus menggunakan verifikasi kepemilikan, bukan nama/jumlah item saja.
- Katalog menu, kategori, detail, harga, ketersediaan, pencarian/filter.
- Keranjang, jumlah item, catatan khusus bila diizinkan.
- Checkout Guest/Member dengan nama pelanggan.
- Metode pembayaran VA, QRIS, dan Cash.
- Promo/paket yang tersedia, ringkasan diskon dan total.
- Penukaran poin nominal oleh Member sesuai aturan.
- Nomor pesanan, instruksi pembayaran, dan pelacakan status.
- Riwayat dan saldo poin Member.

### Cashier Web
- Antrean seluruh pesanan belum selesai dengan pencarian dan filter status.
- Detail pembayaran dan item, termasuk catatan serta status kesiapan per kelompok Makanan/Minuman/Lainnya.
- Aksi status yang sesuai tahap dan otorisasi.
- Konfirmasi pembayaran tunai; pembayaran VA/QRIS mengikuti verifikasi provider.
- Pembaruan ketersediaan menu.
- Pemicu cetak invoice/KOT, pencatatan kegagalan, dan cetak ulang tanpa transaksi ganda.
- Halaman Pesanan Selesai yang terpisah, dengan pencarian/filter dan detail historis.

### Admin/Marketing Web
- CRUD kategori dan menu, gambar, harga, status ketersediaan (sesuai kebijakan peran).
- Pengelolaan paket/bundle dengan komponen tetap dan harga khusus.
- Pengelolaan promo/voucher MVP dengan aturan sederhana dan periode berlaku.
- Banner serta informasi toko.
- Pengelolaan akun kasir dan hak akses berbasis peran.
- Konfigurasi poin melalui bagian terpisah: **Aturan Perolehan Poin** dan **Aturan Penukaran Poin**.

### Program Poin — Keputusan Produk
- MVP memperoleh poin berdasarkan nominal belanja.
- MVP menukar poin menjadi potongan nominal.
- Admin mengatur parameter aturan dalam batas yang didukung aplikasi.
- Poin diberikan setelah pesanan berstatus `SELESAI`.
- Perubahan aturan tidak mengubah transaksi poin historis; transaksi menyimpan snapshot/rujukan aturan yang berlaku.
- Setiap perolehan, penggunaan, pengembalian, kedaluwarsa, atau koreksi adalah entri riwayat terpisah.
- Jika pesanan yang menggunakan poin dibatalkan/refund, poin dikembalikan sesuai kebijakan refund yang ditetapkan.
- Riwayat tidak dihapus untuk koreksi saldo; buat transaksi koreksi dengan alasan dan identitas admin.
- Izin mengubah aturan poin dibatasi untuk peran berwenang.
- Persentase dan reward produk ditunda sampai setelah MVP teruji.

## 7. Prinsip UX dan Desain

- Mobile-first dan responsif pada ponsel, tablet, dan desktop.
- Customer: atmosfer coffee shop modern-industrial/neo-brutalist, namun katalog dan checkout tetap cepat dicapai.
- Kasir: antarmuka operasional yang sederhana, padat informasi penting, tombol aksi jelas dan mudah disentuh.
- Admin: navigasi terstruktur dan formulir/data mudah dikelola pada desktop, tanpa kehilangan usability mobile.
- Target sentuh minimum 44×44 px, status memakai teks selain warna, hierarki dan pesan kesalahan jelas.
- Tidak menggunakan nomor/lokasi meja.

## 8. Alur Utama

1. Pelanggan memilih menu dan checkout.
2. Server menghitung ulang harga, diskon, poin, dan ketersediaan; membuat pesanan unik dengan status pembayaran dan status pesanan terpisah.
3. Pembayaran Cash dikonfirmasi kasir; VA/QRIS menunggu verifikasi provider.
4. Setelah pembayaran sah, kasir mengonfirmasi pesanan.
5. Sistem membuat pekerjaan invoice dan KOT; kegagalan cetak dapat dicoba ulang tanpa menggandakan transaksi.
6. Kasir memperbarui kesiapan per kelompok kategori berdasarkan informasi barista/dapur; perubahan diterapkan ke seluruh item makanan, minuman, atau kategori lainnya yang berada dalam kelompok tersebut.
7. Setelah semua item siap, status utama menjadi `SIAP DIAMBIL`; setelah diserahkan, kasir menandai `SELESAI`.
8. Pesanan selesai dipindahkan dari antrean aktif ke halaman riwayat. Poin yang memenuhi syarat dicatat setelah selesai.

## 9. Indikator Keberhasilan

- Alur inti pelanggan dapat diselesaikan pada ponsel tanpa scroll horizontal.
- Kasir dapat menemukan pesanan aktif dan memperbarui status tanpa membuka banyak halaman.
- Pesanan selesai tidak memenuhi antrean aktif dan tetap dapat dicari.
- Pembayaran dan poin tercatat dengan jejak audit.
- Perubahan ketersediaan tercermin pada katalog sebelum checkout berikutnya.
- Pengujian fungsional inti lulus dan dapat dilanjutkan ke UAT.

## 10. Risiko dan Ketergantungan

- Provider VA/QRIS belum ditentukan.
- Printer kasir dan dapur/bar, koneksi, serta mekanisme print belum ditentukan.
- Kebijakan refund/pembatalan, nilai poin, batas pemakaian poin, masa berlaku, kombinasi diskon, dan aturan promo final perlu dikonfirmasi.
- Perilaku stok ketika stok habis setelah checkout perlu didefinisikan.

## 11. Tahapan Produk

1. Konfirmasi kebutuhan dan desain skema data.
2. Fondasi autentikasi, role, master data, dan katalog.
3. Keranjang, checkout, pesanan, serta pembayaran Cash.
4. Antrean kasir, status item, ketersediaan, dan riwayat selesai.
5. Paket/promo/voucher MVP dan ledger poin.
6. Invoice/KOT dan uji cetak pada perangkat target.
7. Integrasi provider pembayaran dan penyempurnaan admin.
8. Uji fungsional, keamanan, usability, dan UAT.
