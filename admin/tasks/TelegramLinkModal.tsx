import React, { useState } from 'react';
import { Send, Copy, Check, X, Loader2, ExternalLink } from 'lucide-react';

async function getAuthToken(): Promise<string> {
  const { getAuth } = await import('firebase/auth');
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

interface TelegramLinkModalProps {
  onClose: () => void;
}

const TelegramLinkModal: React.FC<TelegramLinkModalProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyLinked, setAlreadyLinked] = useState(false);

  const generateCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/telegram/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kod oluşturulamadı');
      setCode(data.code);
      setAlreadyLinked(data.alreadyLinked || false);
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const copyCommand = () => {
    if (!code) return;
    navigator.clipboard.writeText(`/start ${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-500" />
            <h2 className="font-grotesk text-lg font-bold text-[#171717]">
              Telegram Bağlantısı
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          {!code ? (
            <>
              <p className="font-commons text-sm text-neutral-600 leading-relaxed">
                Telegram botunu hesabınıza bağlayarak görevlerinizi Telegram üzerinden yönetebilirsiniz:
              </p>
              <ul className="font-commons text-sm text-neutral-500 space-y-1.5 ml-1">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  Sabah günlük görev özeti alın
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  Telegram'dan görev oluşturun
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  Periyodik hatırlatmalar alın
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  Görevleri hızlıca tamamlayın
                </li>
              </ul>

              {error && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                  <p className="font-commons text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                onClick={generateCode}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#171717] text-white hover:bg-neutral-800 transition-colors font-commons text-sm font-medium disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Bağlantı Kodu Oluştur
              </button>
            </>
          ) : (
            <>
              {alreadyLinked && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="font-commons text-sm text-amber-700">
                    Hesabınız zaten bağlı. Bu kod ile yeniden bağlayabilirsiniz.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <p className="font-commons text-sm text-neutral-600">
                  <span className="font-semibold">1.</span> Telegram'da botu açın:
                </p>
                <a
                  href="https://t.me/taskerint_bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  <Send className="w-4 h-4 text-blue-600" />
                  <span className="font-commons text-sm font-medium text-blue-700">
                    @taskerint_bot
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-blue-400 ml-auto" />
                </a>

                <p className="font-commons text-sm text-neutral-600">
                  <span className="font-semibold">2.</span> Bota şu komutu gönderin:
                </p>
                <div
                  onClick={copyCommand}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-neutral-50 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors group"
                >
                  <code className="font-mono text-sm text-[#171717] font-semibold">
                    /start {code}
                  </code>
                  <button className="p-1 rounded-lg group-hover:bg-neutral-200 transition-colors">
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-neutral-400" />
                    )}
                  </button>
                </div>

                <p className="font-commons text-xs text-neutral-400 text-center">
                  Bu kod 10 dakika geçerlidir
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TelegramLinkModal;
