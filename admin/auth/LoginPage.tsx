import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const { signIn, resetPassword, error, clearError, user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    clearError();

    try {
      await signIn(email, password);
      // Redirect clients to portal, everyone else to admin
      // Note: user state may not be updated yet — rely on onAuthStateChanged redirect below
      navigate('/admin');
    } catch (err) {
      // Error is handled in AuthContext
    } finally {
      setIsLoading(false);
    }
  };

  // After successful login, redirect clients to portal
  React.useEffect(() => {
    if (user?.role === 'client') {
      navigate('/portal', { replace: true });
    }
  }, [user, navigate]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    clearError();

    try {
      await resetPassword(email);
      setResetEmailSent(true);
    } catch (err) {
      // Error is handled in AuthContext
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#ebeef8] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-grotesk text-4xl font-bold text-[#171717]">Intiba</h1>
          <p className="font-grotesk text-neutral-600 mt-2">Admin Panel</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {!showForgotPassword ? (
            <>
              <h2 className="font-grotesk text-2xl font-bold text-[#171717] mb-6">
                Giris Yap
              </h2>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2"
                >
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-grotesk text-red-600">{error}</p>
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-sm font-grotesk font-medium text-neutral-700 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-neutral-200 bg-[#fffceb] font-grotesk text-[#171717] focus:outline-none focus:border-neutral-400 transition-colors"
                      placeholder="ornek@email.com"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-grotesk font-medium text-neutral-700 mb-1">
                    Sifre
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 rounded-xl border-2 border-neutral-200 bg-[#fffceb] font-grotesk text-[#171717] focus:outline-none focus:border-neutral-400 transition-colors"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Forgot Password Link */}
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(true);
                      clearError();
                    }}
                    className="text-sm font-grotesk text-neutral-600 hover:text-[#171717] transition-colors"
                  >
                    Sifremi Unuttum
                  </button>
                </div>

                {/* Submit Button */}
                <motion.button
                  type="submit"
                  disabled={isLoading || !email || !password}
                  className="w-full py-4 bg-neutral-900 text-white rounded-full font-grotesk font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  whileHover={!isLoading ? { scale: 1.02 } : {}}
                  whileTap={!isLoading ? { scale: 0.98 } : {}}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Giris Yapiliyor...</span>
                    </>
                  ) : (
                    <span>Giris Yap</span>
                  )}
                </motion.button>
              </form>
            </>
          ) : (
            <>
              <h2 className="font-grotesk text-2xl font-bold text-[#171717] mb-2">
                Sifremi Sifirla
              </h2>
              <p className="font-grotesk text-neutral-600 text-sm mb-6">
                Email adresinizi girin, size sifre sifirlama baglantisi gonderelim.
              </p>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2"
                >
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-grotesk text-red-600">{error}</p>
                </motion.div>
              )}

              {resetEmailSent ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="font-grotesk text-neutral-700 mb-4">
                    Sifre sifirlama baglantisi <strong>{email}</strong> adresine gonderildi.
                  </p>
                  <button
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetEmailSent(false);
                      clearError();
                    }}
                    className="font-grotesk text-[#171717] font-semibold hover:underline"
                  >
                    Girise Don
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-grotesk font-medium text-neutral-700 mb-1">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-neutral-200 bg-[#fffceb] font-grotesk text-[#171717] focus:outline-none focus:border-neutral-400 transition-colors"
                        placeholder="ornek@email.com"
                        required
                      />
                    </div>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={isLoading || !email}
                    className="w-full py-4 bg-neutral-900 text-white rounded-full font-grotesk font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    whileHover={!isLoading ? { scale: 1.02 } : {}}
                    whileTap={!isLoading ? { scale: 0.98 } : {}}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Gonderiliyor...</span>
                      </>
                    ) : (
                      <span>Sifirlama Baglantisi Gonder</span>
                    )}
                  </motion.button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      clearError();
                    }}
                    className="w-full py-3 font-grotesk text-neutral-600 hover:text-[#171717] transition-colors"
                  >
                    Girise Don
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center mt-6 font-grotesk text-sm text-neutral-500">
          &copy; {new Date().getFullYear()} Intiba. Tum haklari saklidir.
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
