# IntelWatch

Aplikasi web threat intelligence berbahasa Indonesia. Dua target memakai antarmuka yang sama:

- **Hosting mandiri (`self-host/`)**: aplikasi lengkap dengan login Google langsung, SQLite persisten, pengelolaan email analis, investigasi IP multi-sumber, dan pencarian sosial.
- **Sites**: preview dashboard publik, contoh data dan feed CISA. Login Google tidak didukung oleh identitas bawaan Sites; gunakan target hosting mandiri untuk login Google. Fitur analis di preview tetap tertutup tanpa konfigurasi administrator Sites.

## Fitur

Halaman awal login Google, dashboard setelah login, filter keyword/kategori/prioritas/wilayah/periode, grafik yang mengikuti filter, detail laporan dan ekspor JSON. Tombol sinkronisasi memuat katalog [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog). Angka demonstrasi bukan laporan aktual. Prioritas Critical/High untuk CISA merupakan klasifikasi internal berdasarkan keterkaitan ransomware, **bukan skor CVSS resmi**. Grafik menghitung penambahan entri KEV, bukan jumlah serangan dunia nyata. Sumber CISA bersifat global; bukan atribusi geografi korban.

Investigasi IPv4: [Shodan](https://developer.shodan.io/api), [Recorded Future](https://docs.recordedfuture.com/reference/ip-lookup), [AbuseIPDB](https://docs.abuseipdb.com/), [AlienVault OTX](https://github.com/AlienVault-OTX/OTX-Python-SDK), dan [VirusTotal](https://docs.virustotal.com/reference/ip-info). Key masing-masing sumber diatur di server; status konfigurasi tidak berarti API sudah diuji. Penyedia tanpa key atau gagal akan menampilkan status sendiri. Langganan dan kuota tetap mengikuti penyedia.

Pencarian sosial: keyword melalui API Bluesky dan X, maksimum 30 posting, ekspor serta riwayat pribadi tersimpan di database. Ini pencarian satu kali, bukan crawler terjadwal. Endpoint publik Bluesky dapat membatasi pencarian atau mewajibkan autentikasi; aplikasi menampilkan kegagalan sumber tanpa data buatan. X memerlukan bearer token dengan izin recent search. Platform lain memerlukan adapter API tambahan; tidak mengambil posting privat.

## Jalankan aplikasi Google

Memerlukan Node.js >=22.13 dan pnpm 11.25.0.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm exec vite build --config self-host/vite.config.ts
cp self-host/.env.example self-host/.env
node --env-file=self-host/.env self-host/server.mjs
```

Buka `http://localhost:3000`. Halaman login dapat diakses publik. Dashboard dan data pada hosting mandiri membutuhkan login terverifikasi. Preview Sites memiliki tombol pratinjau dashboard. Administrator pertama **wijayawahyudiakbar@gmail.com**. Akun Gmail administrator diterima; pembatasan domain Workspace bersifat opsional dan kosong secara default. OAuth Client ID belum diisi; login menampilkan status belum aktif hingga dikonfigurasi. Jangan menggunakan alamat email arbitrer sebagai bypass login.

## Membuat Google OAuth Web Client ID

1. Buka [Google Cloud Console](https://console.cloud.google.com/) dengan akun yang memiliki izin project organisasi. Buat/pilih project.
2. Pada **Google Auth Platform**, isi Branding, Audience, dan Data Access. Pilih audience External agar akun Gmail diterima; ketika aplikasi masih dalam mode Testing, tambahkan email administrator sebagai Test User. Login hanya menggunakan identitas dasar, email dan profil.
3. Pada **Clients**, buat OAuth client dengan tipe **Web application**.
4. Tambahkan Authorized JavaScript origin `http://localhost:3000` untuk lokal serta origin HTTPS hosting final, misalnya `https://intelwatch.perusahaan.com`. Gunakan origin tanpa path. Implementasi ini memakai Google Identity Services callback JavaScript dan tidak memerlukan redirect URI atau client secret.
5. Isi `GOOGLE_CLIENT_ID` di environment server. Atur `APP_ORIGIN` persis sesuai origin yang diakses. Biarkan `GOOGLE_WORKSPACE_DOMAIN` kosong untuk menerima Gmail administrator dan akun Google terdaftar. Isi hanya bila seluruh pengguna harus berada pada satu domain Workspace tertentu.
6. Restart server. Pilih **Masuk dengan Google** dan gunakan email administrator. Daftarkan email analis melalui Manajemen pengguna. Pengguna yang tidak terdaftar ditolak meskipun memiliki akun dalam domain yang sama.

Verifikasi server mengikuti [panduan token Google](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token): tanda tangan RS256 terhadap JWKS Google, issuer, audience, expiry, nonce, email terverifikasi, serta kepemilikan email Gmail atau klaim Workspace `hd`. Jika pembatasan domain dikonfigurasi, klaim `hd` harus sesuai. Sesi berupa token acak; hanya hash disimpan di SQLite, cookie HttpOnly/SameSite/secure pada HTTPS, berakhir setelah 8 jam. Pemeriksaan membership dilakukan di setiap operasi. Pencabutan pengguna mencabut sesinya. Login Google end-to-end belum dapat diuji tanpa OAuth Client ID nyata.

## Hosting publik dengan Docker

Dari root proyek:

```sh
docker build -f self-host/Dockerfile -t intelwatch .
docker run --env-file self-host/.env -p 3000:3000 -v intelwatch-data:/app/data intelwatch
```

Pasang di server/hosting Docker milik organisasi, gunakan reverse proxy HTTPS, dan atur `APP_ORIGIN` ke origin HTTPS final. Simpan SQLite di volume persisten. Deployment ini satu instance SQLite; untuk banyak instance migrasikan database ke layanan terpusat. Jangan memasukkan file `.env`, database, atau API key ke Git/image. Konfigurasi secret melalui environment hosting. Backup volume data sesuai kebijakan organisasi. VPS/domain untuk deployment Google belum disediakan.

## Environment

| Nama | Fungsi |
| --- | --- |
| `GOOGLE_CLIENT_ID` | OAuth Web Client ID Google (bukan secret) |
| `GOOGLE_WORKSPACE_DOMAIN` | Domain Google Workspace opsional; kosong untuk Gmail dan akun Google terdaftar |
| `ADMIN_EMAILS` | Email administrator, dipisahkan koma |
| `APP_ORIGIN` | Origin aplikasi, untuk pembatasan request POST |
| `PORT` | Port server, default 3000 |
| `DATABASE_PATH` | Path SQLite opsional, default self-host/data/intelwatch.sqlite |
| `SHODAN_API_KEY` | API key Shodan |
| `RECORDED_FUTURE_API_KEY` | API key Recorded Future |
| `ABUSEIPDB_API_KEY` | API key AbuseIPDB |
| `OTX_API_KEY` | API key AlienVault |
| `VIRUSTOTAL_API_KEY` | API key VirusTotal |
| `X_BEARER_TOKEN` | Token X recent search |

## Verifikasi

```sh
pnpm exec tsc --noEmit
node --test self-host/auth.test.mjs
pnpm exec vite build --config self-host/vite.config.ts
```

Tests memeriksa verifikasi identitas Google dan penolakan signature palsu, audience salah, expiry, nonce, issuer, domain, email belum terverifikasi, dan email eksternal tanpa klaim Workspace. Integrasi API berbayar tidak diuji langsung tanpa key.

## Memperluas integrasi

Tambahkan sumber pada daftar `providers` dan implementasikan adapter server pada `self-host/server.mjs` (dan app/api/intel/route.ts bila diperlukan untuk Sites). Gunakan hostname API tetap, authorization server-side, timeout, dan respons error per sumber. Jangan menerima URL sumber arbitrer dari pengunjung. Untuk crawling kontinu, tambahkan scheduler/job queue hosting dan strategi pagination serta kuota; belum termasuk dalam versi ini.

## Sites preview

Manifest `.openai/hosting.json` dan migrasi `drizzle/` adalah konfigurasi target Sites. Sumber hosting mandiri berdiri sendiri dan tidak menggunakan autentikasi ChatGPT. Situs publik hanya menampilkan data contoh sampai pengguna memilih sumber CISA. Identitas Google, API key, dan sesi hosting mandiri tidak dikirim ke Sites.
