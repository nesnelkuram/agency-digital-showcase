# intiba — Görev Yoldaşı (menü çubuğu uygulaması)

macOS menü çubuğunda yaşayan, Firestore'daki görevlerini izleyip seni proaktif olarak
dürten native bir companion. Web dashboard'undaki **ŞİMDİ** modülünün masaüstü/native uzantısı.

Tauri 2 (Rust kabuk) + React + Vite + Firebase ile yazılmıştır. Ana repodaki
`.env.local` dosyasındaki `VITE_FIREBASE_*` anahtarlarını paylaşır (vite `envDir: "../"`).

## Ne yapar

İki yüzeyi var (tek React kod tabanı, pencere etiketine göre yönlenir):

- **Tam uygulama penceresi** (`main`) — dock'ta, resizable, minimize edilebilir gerçek bir
  uygulama. Sol: görev listesi (filtre: Tümü/Devam/Bugün). Sağ: seçili görevin **tüm
  özellikleri** (öncelik skoru, Eisenhower, deadline, kategori, atanan, risk, etiketler,
  AI gerekçesi, alt görevler, notlar) + **büyük sayaç ve Başla/Duraklat/Bitti** butonları.
  Sayaç web app'in `nowService`'i ile birebir aynı alanları yazar → web ve masaüstü senkron.
- **Menü çubuğu paneli** (`popover`) — tray ikonuna tıklayınca tray'in altında açılan küçük
  saydam panel: hızlı bakış + "Uygulamayı Aç". Odak kaybında kapanır. Bildirim motoru burada koşar.
- **Native bildirimlerle dürter** (`shared/services` cron'larındaki mantığın yerel karşılığı):
  1. ⏰ **Deadline yaklaşıyor** — 2 gün / 1 gün / 12s / 6s / 3s / 1s kala + "GECİKTİ".
  2. 🏷️ **Süre/öncelik koymadın** — deadline'sız, düşük skorlu görevler için (günde en fazla 3).
  3. 🌅 **Bugünü planladın mı?** — sabah 08:00–12:00, bugün için tarihli görev yoksa.
- **Açılışta otomatik başlar** (autostart). Panelden açılıp kapatılabilir.
- Tetiklenen her uyarı `localStorage`'da işaretlenir → aynı bildirim tekrar gelmez.

## Geliştirme

```bash
cd desktop
npm install
npm run tauri dev      # canlı geliştirme (Rust + Vite)
```

## Üretim build'i + kurulum

```bash
npm run tauri build    # .app üretir
cp -R src-tauri/target/release/bundle/macos/intiba.app /Applications/
open /Applications/intiba.app
```

> İlk açılışta macOS bildirim izni ister — **İzin Ver**. İkona tıklayıp Firebase
> e-posta/şifrenle (web dashboard ile aynı hesap) giriş yap. Oturum diskte kalır.

## Mimari

| Dosya | Görev |
|---|---|
| `src-tauri/src/lib.rs` | İki pencere, tray menü, Regular policy, popover toggle/blur-hide, dock reopen |
| `src/App.tsx` | Pencere etiketine göre yönlendirme (popover → `PopoverView`, main → `DashboardView`) |
| `src/firebase.ts` | Firebase init (ana repodaki `.env.local` paylaşımı) |
| `src/tasks.ts` | Auth + `tenantId` çözümü + `tasks`/alt görev `onSnapshot` abonelikleri |
| `src/timerService.ts` | `nowService` ile birebir başlat/duraklat/tamamla (Firestore yazımı) |
| `src/DashboardView.tsx` | Tam uygulama: liste + filtre + detay |
| `src/TaskDetail.tsx` | Görevin tüm özellikleri + sayaç kontrolleri |
| `src/PopoverView.tsx` | Kompakt menü-çubuğu paneli + bildirim motoru |
| `src/rules.ts` | Dürtme kural motoru (deadline / süresiz / planlama) |
| `src/notify.ts` | Tauri notification plugin sarmalayıcı |
| `src/hooks.ts`, `src/ui.tsx`, `src/windowControl.ts` | paylaşılan hook'lar, görsel yardımcılar, pencere kontrolü |

## Sonraki adımlar (henüz yapılmadı)

- Aktivite takibi: hangi uygulamada ne kadar vakit — otomatik (NSWorkspace/Accessibility — Rust tarafı).
- Detaydan not/süre/deadline **düzenleme** (şu an sayaç dışı alanlar çoğunlukla salt-okunur).
- Özel monokrom menü çubuğu ikonu.
