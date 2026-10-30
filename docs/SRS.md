# Software Requirements Specification (SRS) — SA.TUANG COFFEE

## 1. Tujuan dan Konvensi Dokumen

Dokumen ini mendefinisikan seluruh kebutuhan fungsional (*Functional Requirements*) dan nonfungsional (*Non-Functional Requirements*) untuk sistem web **SA.TUANG COFFEE**. Dokumen ini menjadi acuan mutlak spesifikasi teknis, skema database, antarmuka REST API, pengujian otomatis, serta kesiapan operasional produksi.

Konvensi kata kunci:
* **HARUS (SHALL / MUST):** Kebutuhan wajib yang telah terimplementasi dan harus selalu dipenuhi oleh sistem.
* **SEBAIKNYA (SHOULD):** Rekomendasi teknis operasional untuk performa dan skalabilitas lanjutan.

---

## 2. Ruang Lingkup Sistem & Arsitektur

Sistem dirancang dengan arsitektur modern terpisah (*decoupled architecture*):
* **Backend API:** Laravel 11 (PHP 8.2+) RESTful API, PostgreSQL 17 / SQLite (pengujian), Laravel Sanctum untuk otentikasi token berbasis bearer.
* **Frontend SPA:** React 19 + TypeScript + Vite, Vanilla CSS modular dengan design system terkurasi (Space Grotesk, DM Sans, Georgia), mendukung 3 portal dalam satu bundel SPA:
  1. **Customer Web (`/`):** Katalog menu hierarkis, pemesanan Guest & Member, pelacakan pesanan real-time.
  2. **Cashier Web (`/kasir`):** Antrean kasir, countdown 10 menit, manajemen kesiapan grup Food/Drink, konfirmasi pembayaran cash.
  3. **Admin Web (`/admin`):** Dashboard analitik, CRUD katalog 2-tingkat, bundle, promo, banner, manajemen staf (RBAC), dan audit trail.
* **Barista & Dapur:** Tidak menggunakan aplikasi digital mandiri; bekerja menggunakan tiket Kitchen Order Ticket (KOT) fisik dan koordinasi visual antrean kasir.

---

## 3. Aktor dan Matriks Hak Akses (RBAC)

| Aktor / Peran | Lingkup Akses | Hak Akses Utama |
| :--- | :--- | :--- |
| **Guest (Tamu)** | Customer Web (`/`) | Menjelajahi katalog hierarkis, memesan tanpa akun (hanya nama pemesan), menerima tiket harian (#042), melacak status pesanan, dan menandai pesanan selesai jika membawa token perangkat yang cocok. |
| **Member** | Customer Web (`/`) | Hak akses Guest ditambah pendaftaran via nomor WhatsApp (`08...`) & email, login akun, histori pesanan terpusat, dan akumulasi saldo poin loyalitas. |
| **Kasir (`cashier`)** | Cashier Web (`/kasir`) | Melihat antrean pesanan aktif, memfilter status, mencari nomor tiket harian/nama, memvalidasi uang tunai, memperbarui kesiapan grup Food/Drink, toggle stok produk habis, dan mengakses arsip pesanan selesai. |
| **Admin (`admin`)** | Admin Web (`/admin`) + Cashier Web | Seluruh hak akses Kasir ditambah CRUD kategori hierarkis, CRUD produk & bundle, manajemen voucher promo & banner, manajemen staf kasir/admin, dan akses penuh ke audit log sistem. |
| **Sistem Backend** | Background & API | Validasi kalkulasi harga sisi server, penegakan rate limiting, pembersihan pesanan kedaluwarsa 10 menit, proteksi SSRF, pencatatan transaksi atomik, dan logging audit. |

---

## 4. Kebutuhan Fungsional (Functional Requirements)

### 4.1 Autentikasi, Otorisasi, dan Manajemen Sesi
* **FR-AUTH-01 (Landing Page & Pemilihan Identitas):** Customer Web HARUS menyediakan halaman awal informasional dengan navigasi cepat yang memberikan pilihan fleksibel antara memesan langsung sebagai Guest atau masuk/daftar sebagai Member.
* **FR-AUTH-02 (Registrasi & Login Member):** Sistem HARUS mendukung registrasi Member menggunakan Nama, Email unik, Nomor WhatsApp format Indonesia (`regex:/^08[0-9]{8,12}$/`), dan Kata Sandi minimal 8 karakter. Login mendukung pengenal berupa Email atau Nomor HP dengan kata sandi ter-enkripsi Bcrypt.
* **FR-AUTH-03 (Token Perangkat Guest & Kunci Anti-Spam):** Sesi pelanggan tamu HARUS diidentifikasi dengan `guest_device_token` anonim yang dikirimkan melalui header `X-Device-Token`. Sistem HARUS membatasi satu perangkat tamu hanya boleh memiliki **maksimal 1 pesanan tunai aktif** berstatus `MENUNGGU_PEMBAYARAN`.
* **FR-AUTH-04 (Autentikasi Staf Berbasis Peran):** Endpoint staf (`/api/v1/auth/login`) HARUS memvalidasi akun staf aktif dan mengembalikan token Sanctum dengan otorisasi berbasis peran (`admin` atau `cashier`). Akun nonaktif (`is_active = false`) HARUS ditolak masuk.
* **FR-AUTH-05 (Proteksi Akun Mandiri Admin):** Admin HARUS dicegah dari mengubah peran akunnya sendiri menjadi non-admin atau menonaktifkan status akunnya sendiri.
* **FR-AUTH-06 (Rate Limiting Autentikasi):** Sistem HARUS membatasi percobaan login staf dan member maksimal 5 kali per menit per IP/identitas sebelum memberlakukan penundaan (*HTTP 429 Too Many Requests*). Endpoint registrasi member dibatasi maksimal 15 request per menit.
* **FR-AUTH-07 (Penyeragaman Tampilan Login):** Antarmuka login Admin (`/admin`) HARUS memiliki tata letak, tipografi, warna, dan kontrol input yang seragam dan identik dengan antarmuka login Kasir (`/kasir`).

### 4.2 Katalog Menu dan Hierarki Kategori
* **FR-CAT-01 (Kategori Berjenjang 2-Tingkat):** Sistem HARUS mendukung struktur kategori 2-tingkat yang terdiri dari Kategori Induk (*Parent Category*, level 1) dan Subkategori (*Child Category*, level 2) melalui kolom `parent_id` dan tipe item (`drink` atau `food`).
* **FR-CAT-02 (Pencegahan Siklus Kategori):** Sistem HARUS mencegah kategori yang memiliki subkategori untuk diubah menjadi subkategori dari kategori lain, serta membatasi kedalaman hierarki maksimal 2 tingkat.
* **FR-CAT-03 (Integritas Penghapusan Kategori):** Sistem HARUS menolak penghapusan kategori jika kategori tersebut masih memiliki subkategori atau masih terhubung dengan produk aktif.
* **FR-CAT-04 (Navigasi Katalog Pelanggan):** Antarmuka Customer Web HARUS menampilkan navigasi bertingkat: tab kategori induk utama (Minuman, Makanan, Bundle, Promo) dan baris tombol pil subkategori dinamis di bawahnya.
* **FR-CAT-05 (Pengelompokan Form Produk):** Dropdown pilihan kategori pada formulir modal produk Admin HARUS mengelompokkan subkategori di bawah label kategori induknya menggunakan elemen `<optgroup>`.
* **FR-CAT-06 (Ketersediaan Menu Real-Time):** Perubahan status ketersediaan produk (`is_available`) atau bundle (`is_active`) oleh kasir/admin HARUS segera tercermin pada katalog menu publik. Item yang tidak tersedia HARUS ditolak saat checkout di backend.

### 4.3 Keranjang, Checkout, dan Pesanan
* **FR-ORD-01 (Pemesanan Mandiri Tanpa Hambatan):** Pelanggan Guest HARUS dapat membuat pesanan cukup dengan mengisi Nama Pemesan / Panggilan, tanpa dipaksa mengisi nomor telepon atau nomor meja.
* **FR-ORD-02 (Nomor Tiket Antrean Harian):** Setiap pesanan yang dibuat HARUS menerima dua nomor identitas:
  1. `order_number`: Kode alfanumerik unik sistem (contoh: `ST-261030-AB12CD`).
  2. `daily_ticket_number`: Nomor tiket panggil harian singkat 3-digit (contoh: `#001`, `#042`) yang dihitung berdasarkan jumlah pesanan pada tanggal hari tersebut untuk kemudahan pemanggilan di bar.
* **FR-ORD-03 (Kalkulasi Server-Side & Diskon Snapshot):** Server backend HARUS menghitung ulang subtotal, verifikasi catatan khusus produk (`allow_notes`), potongan promo, dan nilai akhir secara mandiri dari database. Klien dilarang mengirimkan nominal total belanja langsung.
* **FR-ORD-04 (Batas Waktu Pembayaran Cash / 10-Minute Expiry):** Setiap pesanan tunai baru HARUS memiliki batas waktu kedaluwarsa 10 menit sejak dibuat (`expires_at = now() + 10 menit`). Pesanan yang belum dibayar dalam 10 menit otomatis dibatalkan (`DIBATALKAN`) dan kasir dilarang mengonfirmasi pesanan yang telah kedaluwarsa.
* **FR-ORD-05 (Idempotensi Pesanan):** Endpoint pembuatan pesanan HARUS mendukung header `Idempotency-Key` untuk mencegah duplikasi pesanan jika terjadi gangguan jaringan atau klik ganda oleh pelanggan.
* **FR-ORD-06 (Pelacakan Pesanan Anti-IDOR):** Endpoint pelacakan status pesanan publik (`/api/v1/orders/{orderNumber}/status`) HARUS memverifikasi kesesuaian Nomor Pesanan dan Nama Pelanggan secara *case-insensitive* dengan prepared statement SQL sebelum menyajikan data.
* **FR-ORD-07 (Otorisasi Penyelesaian Mandiri Pelanggan):** Endpoint penyelesaian pesanan oleh pelanggan (`/api/v1/orders/{orderNumber}/complete`) HARUS mensyaratkan status pesanan sudah `SIAP_DIAMBIL`, serta memvalidasi kepemilikan sesi Member atau kecocokan `guest_device_token`. Pelanggan asing dilarang menyelesaikan pesanan orang lain hanya dengan menebak nama.

### 4.4 Pembayaran dan Kasir
* **FR-PAY-01 (Metode Pembayaran MVP):** Sistem HARUS mendukung metode pembayaran `cash` di kasir (tunai atau QRIS statis counter). Metode `va` atau `qris` otomatis ditolak dengan pesan validasi aman hingga gateway eksternal dikonfigurasi.
* **FR-PAY-02 (Konfirmasi Pembayaran Kasir):** Kasir HARUS mengonfirmasi penerimaan pembayaran tunai melalui endpoint khusus yang terkunci transaksional (`lockForUpdate`). Konfirmasi yang sukses mengubah `payment_status` menjadi `BERHASIL`, `order_status` menjadi `PESANAN_DITERIMA`, mengosongkan timer `expires_at`, dan mencatat riwayat audit.
* **FR-PAY-03 (Pemberian Poin Loyalitas Member):** Konfirmasi pembayaran atas pesanan milik akun Member HARUS secara otomatis menambahkan poin loyalitas ke saldo akun Member terkait (proporsional 1 poin per Rp 10.000 belanja).

### 4.5 Alur Kesiapan Pesanan (Preparation Groups)
* **FR-STAT-01 (Pemisahan Status Pembayaran dan Status Pesanan):** Status pesanan dan status pembayaran HARUS dikelola secara terpisah.
  * *Status Pesanan:* `MENUNGGU_PEMBAYARAN`, `PESANAN_DITERIMA`, `SEDANG_DIBUAT`, `SIAP_DIAMBIL`, `SELESAI`, `DIBATALKAN`.
  * *Status Pembayaran:* `MENUNGGU`, `BERHASIL`, `DIBATALKAN`.
* **FR-STAT-02 (Grup Kesiapan Kategori):** Item dalam pesanan HARUS diklasifikasikan ke dalam kelompok persiapan berdasarkan `item_type` (`food` atau `drink`/`bundle`). Kasir dapat memperbarui status kesiapan per kelompok menjadi `DIPROSES` atau `SIAP`.
* **FR-STAT-03 (Auto-Advance Kesiapan Pesanan):** Ketika seluruh kelompok item dalam satu pesanan telah ditandai `SIAP`, sistem backend HARUS secara otomatis menaikkan status pesanan menjadi `SIAP_DIAMBIL` tanpa memerlukan pembaruan manual kedua.
* **FR-STAT-04 (Pemisahan Antrean Aktif dan Pesanan Selesai):** Antrean kasir aktif HARUS mengecualikan pesanan yang berstatus `SELESAI` atau `DIBATALKAN`. Pesanan selesai dapat diakses dan dicari melalui tab/endpoint riwayat terpisah (`/api/v1/cashier/orders/completed`).

### 4.6 Cetak Dokumen Operasional (Print Jobs)
* **FR-PRN-01 (Pembuatan Antrean Cetak Otomatis):** Konfirmasi pembayaran yang sah HARUS secara otomatis menghasilkan dua entri pekerjaan cetak di database:
  1. `invoice`: Struk pembayaran untuk kasir / pelanggan.
  2. `kot`: *Kitchen Order Ticket* untuk meja barista / dapur.
* **FR-PRN-02 (Dukungan Cetak Browser):** Web Kasir HARUS mendukung pencetakan nota langsung melalui dialog cetak browser yang diformat presisi untuk printer thermal standar (lebar 72mm - 80mm).

### 4.7 Paket Menu (Bundles) dan Promosi
* **FR-BND-01 (Manajemen Paket Menu):** Admin HARUS dapat membuat paket menu bundle dengan harga khusus dan menghubungkan satu atau lebih produk komponen beserta kuantitasnya.
* **FR-BND-02 (Validasi Ketersediaan Komponen):** Jika salah satu produk penyusun bundle ditandai tidak tersedia atau dihapus, paket bundle tersebut HARUS secara otomatis ditolak saat pelanggan mencoba checkout.
* **FR-PRM-01 (Manajemen Kode Promo/Voucher):** Admin HARUS dapat mengelola kode voucher dengan tipe diskon persentase (maksimal 100%) atau potongan nominal tetap, disertai syarat minimal belanja dan batas maksimal diskon rupiah.
* **FR-PRM-02 (Validasi Masa Berlaku Promo):** Sistem HARUS memvalidasi tanggal mulai (`starts_at`) dan tanggal selesai (`ends_at`) promo saat validasi voucher dan saat checkout.

### 4.8 Upload Media dan Audit Trail
* **FR-MED-01 (Upload File Gambar Aman):** Upload foto produk/banner melalui `/api/v1/admin/upload` HARUS memvalidasi tipe MIME gambar yang sah (`jpeg, png, jpg, webp, gif, bmp, avif`), ukuran maksimal 10MB, dan menyimpan file dengan nama acak serta ekstensi yang ditentukan dari hasil deteksi MIME sistem (`$file->extension()`).
* **FR-MED-02 (Proteksi Anti-SSRF pada Import Gambar URL):** Fitur import gambar dari URL eksternal (`/api/v1/admin/import-url`) HARUS memblokir skema non-HTTP/HTTPS, memblokir host loopback (`localhost`, `127.0.0.1`, `::1`), private network (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), domain lokal (`.local`, `.internal`), serta alamat metadata cloud (`169.254.169.254`).
* **FR-AUD-01 (Pencatatan Audit Trail Mutasi):** Setiap operasi penambahan, perubahan, atau penghapusan pada kategori, produk, bundle, promo, banner, dan staf oleh Admin HARUS mencatat identitas aktor (`actor_id`), aksi (`action`), `before_snapshot`, `after_snapshot`, alamat IP, dan waktu kejadian pada tabel `audit_logs`.

---

## 5. Kebutuhan Nonfungsional (Non-Functional Requirements)

### 5.1 Keamanan (Security)
* **NFR-SEC-01 (Pencegahan SQL Injection):** Seluruh query database HARUS menggunakan Eloquent ORM atau Query Builder dengan parameter binding (*prepared statements*). Dilarang keras menggunakan string concatenation pada raw query.
* **NFR-SEC-02 (Pencegahan Cross-Site Scripting / XSS):** Frontend React HARUS merender seluruh data dinamis melalui escaping bawaan JSX dan dilarang menggunakan `dangerouslySetInnerHTML` tanpa sanitasi HTML ketat.
* **NFR-SEC-03 (Penerapan Rate Limiting API):** Seluruh endpoint API publik HARUS dilindungi middleware `throttle`:
  * `POST /api/v1/orders`: `throttle:30,1` (maksimal 30 request/menit).
  * `POST /api/v1/promotions/validate`: `throttle:30,1`.
  * `GET /api/v1/orders/{orderNumber}/status`: `throttle:60,1`.
  * `POST /api/v1/members/register`: `throttle:15,1`.
  * `POST /api/v1/members/login` & `/auth/login`: `throttle:20,1` + kunci akun dinamis 5 percobaan gagal.
* **NFR-SEC-04 (Penyimpanan Kredensial & Secrets):** Seluruh kata sandi user staf dan customer HARUS di-hash menggunakan algoritma Bcrypt dengan cost factor memadai. Kredensial database dan API keys dilarang masuk ke version control (Git) dan wajib disimpan di file `.env`.
* **NFR-SEC-05 (Kebijakan CORS):** Konfigurasi CORS pada backend HARUS membatasi `allowed_origins` ke domain resmi aplikasi dan melarang wildcard `*` pada lingkungan produksi.

### 5.2 Integritas Data dan Konkurensi
* **NFR-CON-01 (Penguncian Tingkat Baris / Pessimistic Locking):** Seluruh transaksi kritis yang memodifikasi stok produk, ketersediaan bundle, konfirmasi pembayaran pesanan tunai, dan transisi status kesiapan HARUS dibungkus dalam `DB::transaction(..., 3)` dan menggunakan penguncian baris `lockForUpdate()`.
* **NFR-CON-02 (Presisi Moneter):** Seluruh kolom nilai uang (harga, subtotal, diskon, total) HARUS disimpan menggunakan tipe data desimal/numerik tetap (`decimal:2` / `numeric(12,2)`), bukan floating-point IEEE-754.

### 5.3 Kinerja dan Pengalaman Pengguna (Usability & Responsiveness)
* **NFR-UX-01 (Mobile-First Touch Ergonomics):** Seluruh elemen interaktif pada Customer Web dan Cashier Web HARUS memiliki target sentuh minimal 44 × 44 CSS pixels dan dilarang menghasilkan scroll horizontal (*no horizontal overflow*) pada resolusi layar ponsel (320px ke atas).
* **NFR-UX-02 (Kecepatan Muat Frontend):** Bundel JavaScript frontend yang dikompresi gzip HARUS berukuran di bawah 150 KB untuk menjamin waktu muat awal di bawah 1.5 detik pada jaringan seluler 4G.
* **NFR-UX-03 (Desain Bebas Ketergantungan Eksternal):** Seluruh ikon visual antarmuka HARUS menggunakan format SVG lokal mandiri tanpa memuat font icon eksternal pihak ketiga yang lambat.

---

## 6. Model Data Relasional Inti

```
┌──────────────┐       ┌──────────────┐       ┌──────────────────────┐
│  categories  │1     *│   products   │1     *│   bundle_components  │
│--------------│───────│--------------│───────│----------------------│
│ id (PK)      │       │ id (PK)      │       │ id (PK)              │
│ parent_id(FK)│       │ category_id  │       │ bundle_id (FK)       │
│ name         │       │ name, price  │       │ product_id (FK)      │
│ item_type    │       │ item_type    │       │ quantity             │
│ is_active    │       │ is_available │       └──────────┬───────────┘
└──────────────┘       │ allow_notes  │                  │*
                       └──────┬───────┘                  │1
                              │1                  ┌──────┴───────┐
                              │*                  │   bundles    │
                       ┌──────┴───────┐           │--------------│
                       │ order_items  │           │ id (PK)      │
                       │--------------│           │ name, price  │
                       │ id (PK)      │           │ is_active    │
                       │ order_id(FK) │           └──────────────┘
                       │ product_id   │
                       │ quantity     │
                       │ line_total   │
                       │ prep_status  │
                       └──────┬───────┘
                              │*
                              │1
┌──────────────┐       ┌──────┴───────────────┐       ┌──────────────┐
│  customers   │1     *│        orders        │1     *│   payments   │
│--------------│───────│----------------------│───────│--------------│
│ id (PK)      │       │ id (PK)              │       │ id (PK)      │
│ name, email  │       │ order_number (UK)    │       │ order_id(FK) │
│ phone (UK)   │       │ daily_ticket_number  │       │ method (cash)│
│ points_bal   │       │ customer_id (FK)     │       │ status       │
└──────────────┘       │ guest_device_token   │       │ amount       │
                       │ order_status         │       └──────────────┘
                       │ payment_status       │
                       │ total, subtotal      │
                       │ expires_at           │
                       └──────────────────────┘
```

---

## 7. Kriteria Verifikasi dan Kesiapan Produksi

1. **Pengujian Unit & Fitur Otomatis:**
   Seluruh 48 automated test suites pada direktori `backend/tests/` HARUS berstatus **PASS** saat dieksekusi dengan perintah `php artisan test`.
2. **Kompilasi Frontend Bebas Error:**
   Perintah `npm run build` di direktori `frontend/` HARUS menghasilkan kompilasi bersih tanpa *warning* atau *type-error* TypeScript (`tsc -b`).
3. **Audit Keamanan Terverifikasi:**
   Endpoint telah melewati audit independen untuk verifikasi proteksi XSS, SQLi, SSRF, IDOR, dan Brute-force rate limiting.
