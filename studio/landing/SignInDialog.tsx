import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface SignInDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Tanıtım sayfasının içindeki giriş penceresi.
 * Giriş başarılı olunca AuthContext kullanıcıyı günceller; StudioApp aynı adreste paneli açar.
 */
const SignInDialog: React.FC<SignInDialogProps> = ({ open, onClose }) => {
  const { signIn, resetPassword, error, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    clearError();
    setResetSent(false);
    const t = window.setTimeout(() => emailRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      returnFocus.current?.focus();
    };
  }, [open, onClose, clearError]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    try {
      await signIn(email, password, true);
      // /studio altında panel kendiliğinden açılır; önizleme adresinden girildiyse panele geç
      if (location.pathname === '/studio/intro') navigate('/studio', { replace: true });
    } catch {
      // Hata mesajı AuthContext'ten gelir
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email) {
      emailRef.current?.focus();
      return;
    }
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch {
      // Hata mesajı AuthContext'ten gelir
    }
  };

  return (
    <div className="sl-modal" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sl-signin" role="dialog" aria-modal="true" aria-labelledby="signin-title" onSubmit={submit}>
        <div className="sl-signin-head">
          <h2 id="signin-title">Sign in to Studio</h2>
          <button type="button" className="sl-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="sl-signin-note">For teams and brands already working with intiba.</p>

        <label className="sl-field">
          <span>Email</span>
          <input
            ref={emailRef}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="sl-field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && (
          <p className="sl-signin-msg is-error" role="alert">
            {error}
          </p>
        )}
        {resetSent && !error && (
          <p className="sl-signin-msg" role="status">
            We sent a reset link to {email}.
          </p>
        )}

        <button type="submit" className="sl-btn is-cobalt sl-signin-submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button type="button" className="sl-link sl-forgot" onClick={forgot}>
          Forgot your password?
        </button>
      </form>
    </div>
  );
};

export default SignInDialog;
