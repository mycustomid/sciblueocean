# Audit UI production SCI Blue Ocean — 26 Oktober 2026

Target: https://sciblueocean.vercel.app. Audit ini membaca situs live di Chromium headless pada desktop 1440×900 dan mobile 390×844, menyimpan screenshot halaman penuh, menguji menu, bahasa, filter, pencarian tanggal, validasi kosong pada formulir, dan memeriksa kode lokal sebagai penjelas. Tidak ada reservasi, pembayaran, atau data pengguna sungguhan yang dibuat.

## Putusan singkat

Visual dasar kuat: foto Miague, palet, serif, dan ritme landing konsisten. Tetapi status HTTP 200 hanya membuktikan halaman statis terbuka. Alur pencarian, booking, status pembayaran, dan Studio belum operasional di production karena `/api/demo/health` dan `/api/demo/public/availability` mengembalikan HTTP 404. Form kontak juga hanya menyalin draf ke clipboard. Situs sendiri menyebut beberapa alur sebagai demonstrasi; copy di CTA publik tetap dapat memberi harapan reservasi aktual.

## Temuan terurut

| Prioritas | Temuan dan bukti live | Penyebab terdekat / tindakan |
|---|---|---|
| P0 | **Funnel reservasi mentok di production.** Pada pencarian tanggal valid, muncul catatan “Mode visuel uniquement”; endpoint availability dan health sama-sama HTTP 404. Booking, lookup, payment, dan Studio memakai API yang sama. | [`site.js`](../public/experience/assets/site.js#L4) dan [`studio.js`](../public/studio/assets/studio.js#L4) mengarah ke `/api/demo`. Sambungkan backend production yang benar atau ubah CTA publik menjadi permintaan kontak yang sungguh terkirim. Jangan menyebut fungsi reservasi READY sebelum receipt end-to-end ada. |
| P1 | **Hero koleksi kosong sekitar 410 px** di desktop dan mobile meski aset gambar berhasil dimuat (`naturalWidth=1024`). Image DOM berukuran 1158×0 di desktop. | [`refinement-v2.css`](../public/experience/assets/refinement-v2.css#L117) memberi `min-height` pada pembungkus, sedangkan [`.photo img`](../public/experience/assets/site.css#L244) absolut dengan tinggi 100%; `.photo` tidak mendapat tinggi pasti. Beri tinggi/aspect-ratio pada kontainer foto dan cek screenshot ulang. |
| P1 | **Pencarian valid menduplikasi hasil.** Miague, Ebène, Amara hasil baru tampil, lalu Ebène dan Amara kartu lama tetap di bawah; hitungan “03 résidences” tidak cocok dengan jumlah visual. | [`performSearch`](../public/experience/assets/site.js#L60) menulis HTML hanya ke elemen pertama `[data-property-result]`. Gunakan satu kontainer hasil, kosongkan semua kartu lama sebelum render, dan perbarui penghitung. |
| P1 | **Pencarian mobile melebar 31 px** (scrollWidth 421 vs viewport 390). Harga terpecah vertikal, tautan desak-desakan, tombol date CTA tetap menutup area form ketika scroll. Visual critic melaporkan overlap kontrol dan horizontal overflow. | [`site.css`](../public/experience/assets/site.css#L872) memakai grid yang mempertahankan min-content anak; aturan mobile [`site.css`](../public/experience/assets/site.css#L1381) hanya mengganti kolom. Terapkan `minmax(0,1fr)`, `min-width:0`, susun kartu hasil satu kolom di 390 px, lalu atur sticky CTA agar tidak menutupi form. |
| P2 | **Bahasa EN hanya sebagian.** Beranda menjadi Inggris dan `html lang=en`; di halaman pembayaran judul tetap “Votre séjour. Votre tranquillité.” dengan indikator EN. Footer dan status pencarian juga bercampur. | Kamus teks parsial di [`site.js`](../public/experience/assets/site.js#L40). Pilih label “English preview” yang jelas di setiap halaman, atau terjemahkan semua teks kritis terutama harga, status, formulir, dan pembayaran. Jangan set `lang=en` pada halaman yang mayoritas Prancis. |
| P2 | **Halaman monthly dan Bonapriso tidak sejajar dengan grid situs.** Judul monthly desktop mulai x=0 dan hanya 30 px, sedangkan heading koleksi punya inset 105 px dan ukuran lebih kuat. Bonapriso juga mulai x=0 lalu memberi ruang kosong lebar sebelum isi berikutnya. | `.editorial-hero-split` belum dibatasi `content-width`, `.editorial-hero-copy` hanya padding vertikal di [`refinement-v2.css`](../public/experience/assets/refinement-v2.css#L115). Samakan inset dan skala judul antartemplate. |
| P2 | **Filter koleksi bekerja tetapi status visualnya salah.** Menekan “À venir” menyisakan dua kartu yang benar dan `aria-pressed=true`, tetapi tombol “Tout voir” tetap bergaya aktif. | [`site.js`](../public/experience/assets/site.js#L58) hanya memperbarui `aria-pressed`; class `active` awal tidak dihapus. Pakai satu sumber state untuk class dan ARIA. |
| P2 | **CTA mobile permanen muncul juga di FAQ, policies, manage, payment, dan contact.** “Résidence Miague / Choisir les dates” mengalihkan fokus dari tugas halaman; pada pencarian ia menimpa form di area viewport bawah. | Atur visibilitas berdasarkan konteks halaman; pada funnel pencarian/booking/status gunakan CTA yang sesuai halaman atau tidak tampilkan. Aturan global ada di [`refinement-v2.css`](../public/experience/assets/refinement-v2.css#L198). |
| P3 | **Microcopy dan detail polish.** “SCIE Blue Ocean” pada copyright berbeda dari logo “SCI Blue Ocean”; label peta Bonapriso menggabung kata; brand tag dua baris kecil; beberapa kartu proyek menampilkan tarif tanpa konteks bahwa proyek belum tersedia. | Periksa string footer, jarak label peta, dan hirarki status “projet en cours”. Visual critic menandai brand tag sebagai awkward wrap di desktop; ini lebih rendah prioritasnya dari bug hero dan funnel. |

## Catatan halaman per halaman

| Halaman live | Hasil visual dan interaksi |
|---|---|
| [`/`](https://sciblueocean.vercel.app/) | Hero kuat dan gambar autentik. Form tanggal, harga awal, dan CTA jelas; tetapi “Vérifier” menuju funnel yang belum punya API production. Mobile menu berfungsi. |
| [`/experience/`](https://sciblueocean.vercel.app/experience/) | Secara visual hampir sama dengan `/`; membuat dua alamat beranda untuk konten yang sama. Menu mobile terbuka dengan enam tautan dan ARIA berubah benar. |
| [`/experience/stays/`](https://sciblueocean.vercel.app/experience/stays/) | Masalah paling kasat mata: blok hero kosong. Kartu tiga residensi rapi. Filter menyaring benar, indikator aktif salah. Catatan “À noter” terlalu dekat tepi kiri. |
| [`/experience/stays/miague/`](https://sciblueocean.vercel.app/experience/stays/miague/) | Galeri foto dan tarif jelas; paling siap secara visual. CTA ke booking demo perlu menyatakan batas fungsi sebelum pengguna mengisi data. |
| [`/experience/stays/ebene/`](https://sciblueocean.vercel.app/experience/stays/ebene/) | Visual render tertata dan status proyek terlihat. Perjelas bahwa angka bulanan adalah indikasi untuk masa depan. |
| [`/experience/stays/amara/`](https://sciblueocean.vercel.app/experience/stays/amara/) | Konsisten dengan Ebène; status proyek terlihat, tetapi tarif dan CTA perlu menjaga ekspektasi ketersediaan. |
| [`/experience/monthly/`](https://sciblueocean.vercel.app/experience/monthly/) | Foto render kuat; copy hero terlalu mepet tepi kiri dan judul terlalu kecil untuk template editorial. Kartu dua proyek di dalam panel terlalu luas di desktop. |
| [`/experience/bonapriso/`](https://sciblueocean.vercel.app/experience/bonapriso/) | Judul menempel tepi kiri; ruang kosong setelah pembuka besar. Label pada ilustrasi peta “BONAPRISODOUALA” tampak tanpa pemisah. |
| [`/experience/our-story/`](https://sciblueocean.vercel.app/experience/our-story/) | Foto besar dan isi mendukung narasi. Label pembuka dan paragraf awal mepet kiri dibanding grid lain; ruang putih atas terasa berlebihan. |
| [`/experience/journal/`](https://sciblueocean.vercel.app/experience/journal/) | Halaman berdiri sendiri, foto dan dua teaser tertata baik; tidak muncul di navigasi utama, sehingga manfaatnya untuk pengunjung rendah. |
| [`/experience/search/`](https://sciblueocean.vercel.app/experience/search/) | Bug layout mobile dan hasil ganda setelah submit valid. Tanggal terbalik tidak lanjut ke hasil; browser/native + skrip menjaga urutan, tetapi pesan kesalahan tidak dekat field. |
| [`/experience/booking/`](https://sciblueocean.vercel.app/experience/booking/) | Tiga tahap dan ringkasan mengomunikasikan proses. Teks estimasi pada ringkasan desktop terpotong saat belum memilih tanggal. Tombol kirim masih tampil meskipun production tidak menyimpan permintaan. |
| [`/experience/manage/`](https://sciblueocean.vercel.app/experience/manage/) | Form dan disclaimer demo jelas; pencarian referensi tidak dapat berhasil tanpa API. CTA mobile tanggal tidak sesuai konteks dan menutupi sebagian form saat scroll. |
| [`/experience/payment/`](https://sciblueocean.vercel.app/experience/payment/) | Layout dua kolom dan validasi field kosong baik. Label langkah “03 · Paiement” memberi kesan flow pembayaran tersedia meski teks bawah menjelaskan belum ada transaksi; lookup pun membutuhkan API 404. |
| [`/experience/contact/`](https://sciblueocean.vercel.app/experience/contact/) | Split foto/form kuat. Copy kecil mengakui tidak ada pengiriman; klik submit hanya menyalin draf ke clipboard, sehingga CTA “Écrire à l'équipe” berakhir tanpa kanal kontak. |
| [`/experience/faq/`](https://sciblueocean.vercel.app/experience/faq/) | Tata letak tanya jawab mudah dipindai; copy menjelaskan pembayaran belum aktif. CTA sticky reservasi tidak relevan dengan beberapa pertanyaan. |
| [`/experience/policies/`](https://sciblueocean.vercel.app/experience/policies/) | Struktur dokumen rapi; CTA sticky mobile mengganggu pembacaan panjang. |
| [`/experience/signin/`](https://sciblueocean.vercel.app/experience/signin/) | Placeholder akun aman dan transparan, tetapi halaman tak terhubung ke alur normal; sebaiknya noindex/ditutup dari navigasi sampai identitas siap. |
| [`/experience/signup/`](https://sciblueocean.vercel.app/experience/signup/) | Sama seperti signin: visual selesai, fungsi belum ada. Jangan biarkan judul “Créer un compte” dianggap pendaftaran aktif. |
| [`/studio/`](https://sciblueocean.vercel.app/studio/) | Desktop/mobile bersih menurut visual critic. Form membutuhkan password demo dan server lokal; tidak dapat menjadi operasi production. Submit kosong diarahkan ke field password oleh validasi browser. |
| [`/studio/dashboard/`](https://sciblueocean.vercel.app/studio/dashboard/) | Tanpa sesi, kembali ke login; request API memunculkan 404. Interior dashboard dan peran lain tidak bisa diaudit sebagai pengguna karena tidak ada sesi demo server pada production. |

## Verifikasi dan batas

- 17 rute yang terhubung dari situs diperiksa pada desktop dan mobile: semuanya HTTP 200, 0 page errors saat pemuatan awal, 0 gambar gagal setelah ditunggu, satu rute dengan overflow horizontal (`/experience/search/`). Tiga rute tambahan (`signin`, `signup`, `journal`) diperiksa desktop.
- Screenshot awal pada `/experience/` dan `/experience/payment/` sempat menunjukkan blok foto polos akibat lazy loading; setelah menunggu dan scroll, gambar muncul. Ini berbeda dari hero koleksi yang tetap kosong karena tinggi `<img>` 0.
- Pencarian tanggal valid memakai 5–7 November 2026, tanpa identitas pengguna dan tanpa submit booking. Hasil menunjukkan duplikasi dan API unavailable. Form payment dan Studio hanya diuji kosong. Dashboard internal dan transaksi nyata belum diuji.
- Visual critic: Studio 0 temuan; search mobile mencatat overflow 31 px dan collision dengan CTA; halaman tamu desktop mencatat brand tag dua baris, yang dinilai sebagai polish rendah.
- Bukti mesin: [`results.json`](production-ui-2026-10-26/results.json), [`flows.json`](production-ui-2026-10-26/flows.json), [contact sheet desktop](production-ui-2026-10-26/desktop-contact-sheet.jpg), [contact sheet mobile](production-ui-2026-10-26/mobile-contact-sheet.jpg), serta screenshot per rute dalam folder yang sama.

## Urutan perbaikan yang disarankan

1. Putuskan status produk: aktifkan backend booking/contact/status dengan bukti receipt, atau ubah seluruh CTA menjadi permintaan informasi yang jujur dan benar-benar terkirim.
2. Pulihkan foto hero koleksi, betulkan render hasil pencarian, dan perbaiki overflow pencarian mobile.
3. Samakan grid hero monthly/Bonapriso/story, betulkan sticky CTA per halaman, dan rapikan state filter.
4. Lengkapi bahasa EN untuk alur kritis atau tampilkan sebagai preview parsial secara eksplisit; selaraskan microcopy/tarif/footer.
