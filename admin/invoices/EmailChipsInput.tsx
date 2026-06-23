import React, { useState } from 'react';
import { X } from 'lucide-react';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

interface Props {
  emails: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
}

/**
 * Çoklu e-posta girişi — yazıp virgül/Enter ile chip'e dönüşür.
 * Yapıştırılan virgüllü listeleri de parçalar. Boşken Backspace son chip'i siler.
 */
const EmailChipsInput: React.FC<Props> = ({ emails, onChange, placeholder }) => {
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState(false);

  const addEmail = (raw: string): boolean => {
    const v = raw.trim();
    if (!v) return true;
    if (!EMAIL_RE.test(v)) {
      setErr(true);
      return false;
    }
    if (!emails.includes(v)) onChange([...emails, v]);
    setErr(false);
    return true;
  };

  const handleChange = (val: string) => {
    // Virgül (yazarken ya da yapıştırınca) → parçalara böl, son parça draft kalır
    if (val.includes(',')) {
      const parts = val.split(',');
      const toAdd = parts.slice(0, -1);
      const fresh = [...emails];
      let ok = true;
      for (const p of toAdd) {
        const t = p.trim();
        if (!t) continue;
        if (EMAIL_RE.test(t)) {
          if (!fresh.includes(t)) fresh.push(t);
        } else {
          ok = false;
        }
      }
      onChange(fresh);
      setDraft(parts[parts.length - 1].trim());
      setErr(!ok);
    } else {
      setDraft(val);
      setErr(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (addEmail(draft)) setDraft('');
    } else if (e.key === 'Backspace' && !draft && emails.length) {
      onChange(emails.slice(0, -1));
    }
  };

  const removeEmail = (idx: number) => onChange(emails.filter((_, i) => i !== idx));

  return (
    <div>
      <div
        className={`w-full px-2 py-1.5 rounded-lg border bg-white flex flex-wrap items-center gap-1.5 focus-within:border-indigo-400 ${
          err ? 'border-red-300' : 'border-neutral-200'
        }`}
      >
        {emails.map((em, i) => (
          <span
            key={em}
            className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-md bg-indigo-50 text-indigo-700 font-commons text-xs"
          >
            {em}
            <button type="button" onClick={() => removeEmail(i)} className="text-indigo-400 hover:text-red-500">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (addEmail(draft)) setDraft('');
          }}
          placeholder={emails.length === 0 ? placeholder || 'muhasebe@firma.com' : 'Başka e-posta ekle…'}
          className="flex-1 min-w-[160px] px-1 py-1 outline-none bg-transparent font-commons text-sm"
        />
      </div>
      {err && <p className="text-[11px] text-red-500 mt-1">Geçerli bir e-posta adresi girin.</p>}
    </div>
  );
};

export default EmailChipsInput;
