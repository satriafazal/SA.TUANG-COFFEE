# Batas Prototipe Customer Web

Dokumen ini mencatat mana yang sudah dapat dicoba di Customer Web dan mana yang masih simulasi. Jangan gunakan data atau akun prototipe untuk pelanggan sungguhan.

## Cakupan yang sudah dibuat

- Landing page informasional khusus SA.TUANG COFFEE Banjar Wijaya; pemesanan hanya dimulai melalui tombol **Pesan Sekarang**.
- Pilihan Member atau Guest. Saat Guest dipilih, pelanggan dapat memilih **Daftar Member** atau **Tidak, lanjut sebagai Guest**.
- Login/registrasi Member demo dengan tampilan terpisah: dashboard/profil ringkas, daftar pesanan, dan halaman poin.
- Katalog, filter kategori, pencarian, keranjang, catatan item jika didukung menu, dan checkout Cash menggunakan katalog/API backend yang tersedia.
- Daftar kode antrean, pembaruan status melalui API, salin kode antrean, dan halaman publik **Lacak Pesanan**. Pelanggan dapat memasukkan kode antrean + nama untuk melacak status lewat API tanpa sesi Guest di browser. Jika kode antrean hilang, tersedia pemulihan simulasi via nomor HP.
- Helper Guest tampil terus di bawah field HP: “Mohon simpan kode antrean. Nomor HP dapat digunakan untuk memulihkan kode antrean.”

## Simulasi yang belum produksi

| Bagian | Perilaku sekarang | Yang diperlukan untuk implementasi nyata |
|---|---|---|
| Akun Member | Profil dan kredensial demo berada di `localStorage`; kata sandi demo disimpan sebagai hash PBKDF2 bersalt di browser. Ini bukan autentikasi server. | Endpoint registrasi/login aman, validasi email, pengelolaan sesi, kebijakan kata sandi, rate limit, reset email, dan pengujian keamanan. Jangan memakai akun prototipe sebagai akun nyata. |
| Sesi Guest | Token demo disimpan di `localStorage` agar sesi bertahan setelah refresh di browser yang sama. | Sesi Guest server-side dengan cookie `HttpOnly`, `Secure`, dan `SameSite`, rotasi/expiry token, pembatasan akses, serta kebijakan retensi. Menghapus data browser atau berganti perangkat dapat menghilangkan akses. |
| Pelacakan pesanan | Halaman publik menerima kode antrean dan nama lalu meminta status ke API; sesi/token Guest browser tidak diperlukan. Salah satu data yang tidak cocok tidak mengembalikan pesanan. | Simpan kode antrean. Nama bukan bukti kepemilikan yang cukup jika digunakan sendiri. Tambahkan rate limit/monitoring dan evaluasi kebijakan privasi; pemulihan ketika kode antrean juga hilang harus memverifikasi kepemilikan melalui OTP provider. |
| Pemulihan kode antrean | Nomor HP hanya mencocokkan data demo yang tersimpan pada browser ini. Tidak ada OTP atau pencarian backend; setelah semua data browser terhapus, mock tidak dapat memulihkan pesanan. | Verifikasi kepemilikan melalui OTP dari provider, pembatasan percobaan, masa berlaku kode, audit, dan alur dukungan ketika HP tidak dapat diakses. Nama dan jumlah item saja bukan bukti kepemilikan. |
| Poin Member | Saldo dummy; daftar transaksi poin belum tersambung ke backend. | Ledger append-only untuk earn/redeem/restore/expire, pemberian hanya saat pesanan `SELESAI`, aturan penukaran nominal, pembatalan/refund, koreksi kompensasi beralasan dan beridentitas admin, serta izin perubahan aturan. |
| VA/QRIS | Pilihan ditampilkan nonaktif dan belum dapat dipakai. | Pemilihan provider, pembuatan instruksi pembayaran, webhook bertanda tangan, rekonsiliasi, penanganan kedaluwarsa/refund, dan uji sandbox/live. Jangan menandai lunas hanya dari redirect browser. |
| Email dan notifikasi | Reset password hanya menampilkan pemberitahuan demo; tidak ada email/SMS/WhatsApp yang dikirim. | Provider, template, persetujuan, retry, pencatatan status pengiriman, dan pencegahan kebocoran informasi pelanggan. |
| Profil outlet | Alamat tingkat jalan/patokan dan tautan peta masih perlu persetujuan pemilik outlet. Jam operasional terkini belum dimasukkan. | Verifikasi alamat, jam, kanal resmi, foto, aset merek, promosi, dan informasi yang boleh dipublikasikan. |
| Poin dan identitas pada order | Order dibuat oleh API Cash yang tersedia; asosiasi Member/Guest untuk daftar pelanggan masih berupa metadata browser. | Relasi akun/guest server-side dan aturan akses riwayat/nota di backend, dengan verifikasi kepemilikan yang sesuai. |

## Sebelum digunakan untuk pelanggan

1. Selesaikan autentikasi, sesi Guest, pembatasan akses order, dan kebijakan privasi/retensi di backend.
2. Sepakati aturan poin dan kembangkan ledger sebelum menunjukkan saldo atau menjanjikan reward.
3. Integrasikan payment provider dan notifikasi nyata; pastikan status backend mengikuti webhook/konfirmasi yang tervalidasi.
4. Konfirmasi alamat, jam, konten publik, harga, ketersediaan, serta persetujuan penggunaan data dan komunikasi dengan pihak SA.TUANG.
5. Uji alur pembatalan/refund, koneksi gagal, refresh, browser/perangkat berbeda, aksesibilitas, dan responsivitas sebelum rilis.

Admin Web tersedia di `/admin`: login role `admin`, dashboard operasional, CRUD kategori/produk, paket menu (bundle builder), promo/voucher potongan diskon, banner pengumuman gerai, daftar & pelacakan seluruh pesanan, pengelolaan akun staf (kasir & admin) dengan proteksi akun mandiri, serta riwayat audit log lengkap. Aturan poin dan integrasi payment gateway digital ditunda sesuai keputusan bisnis terbuka.

Customer Web dan Kasir masih memerlukan UAT sebelum digunakan operasional. Checkout Cash memanggil API; VA/QRIS belum diaktifkan. Cetak invoice/KOT menggunakan dialog cetak browser, bukan integrasi printer perangkat langsung.
