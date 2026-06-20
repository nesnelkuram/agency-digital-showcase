import { useState } from "react";
import { signIn } from "./tasks";
import { isFirebaseConfigured } from "./firebase";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch {
      setError("Giriş başarısız. E-posta/şifreyi kontrol et.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login" data-tauri-drag-region>
      <div className="brand">intiba</div>
      <div className="subtitle">Görev yoldaşına giriş yap</div>
      {!isFirebaseConfigured && (
        <div className="warn">
          ⚠️ Firebase yapılandırılmamış. Ana repodaki <code>.env.local</code>{" "}
          dosyasında VITE_FIREBASE_* anahtarları olmalı.
        </div>
      )}
      <form onSubmit={submit}>
        <input
          type="email"
          placeholder="E-posta"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
        />
        <input
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={busy}>
          {busy ? "Giriş yapılıyor…" : "Giriş Yap"}
        </button>
      </form>
    </div>
  );
}
