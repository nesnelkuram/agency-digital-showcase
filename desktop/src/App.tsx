import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAuthUser } from "./hooks";
import { Login } from "./Login";
import { PopoverView } from "./PopoverView";
import { FilesView } from "./FilesView";
import { currentLabel } from "./windowControl";
import "./App.css";

// Web panosunun yüklendiği uzak adres (iframe ile gömülür).
const WEB_URL = "https://www.intiba.co.uk/admin";

// Yerel React pencereleri:
//   popover → kompakt menü-çubuğu paneli + bildirim motoru
//   main    → tek pencere kabuğu: "Pano" sekmesi (uzak web app, iframe) +
//             "Diskler & Dosyalar" sekmesi (native tarama/önizleme — FilesView).
export default function App() {
  const label = currentLabel();
  if (label === "main") return <MainShell />;
  return <PopoverApp />;
}

type MainTab = "pano" | "files";

// Program açıldığında gelen ana pencere. Disk tarayıcı artık ayrı pencere
// değil; burada üstteki sekmelerden açılır.
function MainShell() {
  const [tab, setTab] = useState<MainTab>("pano");

  // popover / tray, hangi sekmenin açılacağını "open-tab" olayıyla bildirir.
  useEffect(() => {
    const un = listen<MainTab>("open-tab", (e) => {
      if (e.payload === "pano" || e.payload === "files") setTab(e.payload);
    });
    return () => {
      un.then((f) => f());
    };
  }, []);

  return (
    <div className="main-shell">
      <div className="main-tabs" data-tauri-drag-region>
        <button
          className={`mtab${tab === "pano" ? " active" : ""}`}
          onClick={() => setTab("pano")}
        >
          📊 Pano
        </button>
        <button
          className={`mtab${tab === "files" ? " active" : ""}`}
          onClick={() => setTab("files")}
        >
          📁 Diskler & Dosyalar
        </button>
      </div>
      <div className="main-body">
        {/* Pano iframe'i daima mount kalır (sekme değişiminde yeniden
            yüklenip oturum kaybolmasın); sadece gizlenir. */}
        <iframe
          className="pano-frame"
          src={WEB_URL}
          title="Pano"
          style={{ display: tab === "pano" ? "block" : "none" }}
        />
        {/* FilesView native disk API'leri kullandığından yalnızca
            görünürken mount edilir (boşuna disk taraması yapmasın). */}
        {tab === "files" && (
          <div className="files-pane">
            <FilesView />
          </div>
        )}
      </div>
    </div>
  );
}

function PopoverApp() {
  const { user, ready } = useAuthUser();
  if (!ready) {
    return (
      <div className="panel popover">
        <div className="empty">Yükleniyor…</div>
      </div>
    );
  }
  if (!user) return <Login />;
  return <PopoverView user={user} />;
}
