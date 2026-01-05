import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Send, Loader2 } from 'lucide-react';
import { Question, ResultMatrix } from '../../types';

interface OutroQuestionProps {
  question: Question;
  answers: Record<number, string | string[]>;
  scores: Record<number, number>;
  stageResults: Record<number, ResultMatrix>;
  userInfo: {
    name: string;
    businessName: string;
    email?: string;
    phone?: string;
  };
  onEmailSubmit: (email: string, phone?: string) => void;
}

const OutroQuestion: React.FC<OutroQuestionProps> = ({
  question,
  answers,
  scores,
  stageResults,
  userInfo,
  onEmailSubmit,
}) => {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const services = [
    {
      id: 'commercial',
      title: 'Reklam Filmi',
      description: 'Televizyon ve dijital platformlar için profesyonel prodüksiyon. Senaryo, kurgu, renk düzeltme ve ses tasarımı ile tam kapsamlı. 30-60 saniye arası, markanızın hikayesini sinematik dille anlatan geniş bütçeli içerik.',
      duration: '30-60 saniye',
      format: 'TV, YouTube, Web'
    },
    {
      id: 'story',
      title: 'Instagram Story & Reels',
      description: 'Mobil-first, dikkat çeken kısa format videolar. Hızlı kurgu, dinamik geçişler, trend müzikler. 5-15 saniye arası, organik ve otantik görünümlü, sosyal medyada viral olmak için optimize edilmiş içerik.',
      duration: '5-15 saniye',
      format: 'Instagram, TikTok, Shorts'
    },
    {
      id: 'photography',
      title: 'Profesyonel Fotoğraf Çekimi',
      description: 'Menü, mekan ve atmosfer fotoğrafçılığı. Profesyonel ışık kurulumu, styling, post-production. Web sitesi, menü ve sosyal medya için yüksek kaliteli görseller. 50-100 adet düzenlenmiş fotoğraf paketi.',
      format: 'Web, Menü, Instagram Feed'
    },
    {
      id: 'social',
      title: 'Sosyal Medya İçerik Paketi',
      description: 'Aylık düzenli içerik üretimi. 20-30 adet story, 8-12 adet feed post, caption yazımı. Planlama, çekim, kurgu ve yayınlama dahil. Tutarlı görsel dil ve marka sesi ile süreklilik.',
      duration: 'Aylık paket',
      format: 'Tüm sosyal platformlar'
    },
    {
      id: 'branding',
      title: 'Marka Kimliği Tasarımı',
      description: 'Logo, renk paleti, tipografi, kurumsal kimlik rehberi. Menü tasarımı, ambalaj, tabela ve tüm markalaşma materyalleri. Stratejik konumlandırmadan görsel uygulamaya tam paket.',
      format: 'Print & Digital'
    },
    {
      id: 'website',
      title: 'Web Sitesi & Rezervasyon Sistemi',
      description: 'Mobil-responsive, hızlı, SEO-optimized web sitesi. Online rezervasyon entegrasyonu, menü yönetimi, fotoğraf galerisi. Modern tasarım ve kullanıcı dostu arayüz.',
      format: 'Web'
    }
  ];

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) return;

    setIsSubmitting(true);

    try {
      // Prepare comprehensive report
      const selectedServiceNames = selectedServices.map(id =>
        services.find(s => s.id === id)?.title
      ).filter(Boolean).join(', ');

      const reportData = {
        // User Info
        name: userInfo.name,
        businessName: userInfo.businessName,
        email: email.trim(),
        phone: phone.trim() || 'Belirtilmedi',
        date: new Date().toLocaleString('tr-TR'),

        // Requested Services
        requestedServices: selectedServiceNames || 'Belirtilmedi',
        serviceCount: selectedServices.length,

        // Stage Results
        stage0: stageResults[0]?.title || 'N/A',
        stage0Score: Object.keys(scores).filter(k => [3, 4, 5].includes(Number(k))).reduce((sum, k) => sum + scores[Number(k)], 0),
        stage1: stageResults[1]?.title || 'N/A',
        stage2: stageResults[2]?.title || 'N/A',
        stage3: stageResults[3]?.title || 'N/A',
        stage4: stageResults[4]?.title || 'N/A',

        // All Answers (formatted)
        allAnswers: JSON.stringify(answers, null, 2),
        allScores: JSON.stringify(scores, null, 2),

        // FormSubmit configuration
        _subject: `Yeni Brand Strategy Değerlendirmesi - ${userInfo.businessName}`,
        _replyto: email.trim(),
        _template: 'table',
      };

      // Send to FormSubmit.co
      const response = await fetch('https://formsubmit.co/info@intiba.co.uk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(reportData),
      });

      if (response.ok) {
        setIsSubmitted(true);
        onEmailSubmit(email.trim(), phone.trim());
      } else {
        throw new Error('Form submission failed');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      className="flex flex-col items-center gap-8 w-full max-w-2xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <AnimatePresence mode="wait">
        {!isSubmitted ? (
          <motion.div
            key="form"
            className="w-full flex flex-col items-center gap-8"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            {/* Header */}
            <div className="text-center space-y-3">
              <h2 className="text-2xl md:text-3xl font-bold font-grotesk" style={{ color: '#171717' }}>
                Tebrikler, {userInfo.name}! 🎉
              </h2>
              <p className="text-base md:text-lg leading-relaxed font-grotesk" style={{ color: '#525252' }}>
                {userInfo.businessName} için kapsamlı marka stratejisi değerlendirmeniz hazır.
              </p>
              <p className="text-sm leading-relaxed font-grotesk" style={{ color: '#737373' }}>
                Detaylı raporunuzu email adresinize göndermek için lütfen bilgilerinizi girin.
              </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4 w-full">
              <motion.div
                className="p-6 rounded-xl border-2"
                style={{
                  backgroundColor: '#ffffff',
                  borderColor: '#e5e5e5',
                }}
                whileHover={{ borderColor: '#d4d4d4', scale: 1.02 }}
              >
                <div className="text-3xl font-bold font-grotesk mb-1" style={{ color: '#171717' }}>
                  {Object.keys(stageResults).length}
                </div>
                <div className="text-sm font-grotesk" style={{ color: '#525252' }}>
                  Aşama Tamamlandı
                </div>
              </motion.div>

              <motion.div
                className="p-6 rounded-xl border-2"
                style={{
                  backgroundColor: '#ffffff',
                  borderColor: '#e5e5e5',
                }}
                whileHover={{ borderColor: '#d4d4d4', scale: 1.02 }}
              >
                <div className="text-3xl font-bold font-grotesk mb-1" style={{ color: '#171717' }}>
                  {Object.keys(answers).length}
                </div>
                <div className="text-sm font-grotesk" style={{ color: '#525252' }}>
                  Soru Cevaplandı
                </div>
              </motion.div>
            </div>

            {/* Services Section */}
            <div className="w-full space-y-4">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold font-grotesk" style={{ color: '#171717' }}>
                  Neye İhtiyacınız Olduğunu Düşünüyorsunuz?
                </h3>
                <p className="text-sm font-grotesk" style={{ color: '#737373' }}>
                  Birden fazla seçenek seçebilirsiniz
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {services.map((service) => {
                  const isSelected = selectedServices.includes(service.id);
                  return (
                    <motion.div
                      key={service.id}
                      onClick={() => toggleService(service.id)}
                      className="p-5 rounded-xl border-2 cursor-pointer transition-all duration-200"
                      style={{
                        backgroundColor: isSelected ? '#fffceb' : '#ffffff',
                        borderColor: isSelected ? '#171717' : '#e5e5e5',
                      }}
                      whileHover={{
                        scale: 1.02,
                        borderColor: isSelected ? '#171717' : '#d4d4d4',
                      }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-200"
                          style={{
                            backgroundColor: isSelected ? '#171717' : 'transparent',
                            borderColor: isSelected ? '#171717' : '#d4d4d4',
                          }}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold font-grotesk mb-1 text-sm" style={{ color: '#171717' }}>
                            {service.title}
                          </div>
                          <p className="text-xs font-grotesk leading-relaxed mb-2" style={{ color: '#525252' }}>
                            {service.description}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {service.duration && (
                              <span
                                className="text-xs font-grotesk px-2 py-1 rounded"
                                style={{ backgroundColor: '#f5f5f5', color: '#737373' }}
                              >
                                {service.duration}
                              </span>
                            )}
                            <span
                              className="text-xs font-grotesk px-2 py-1 rounded"
                              style={{ backgroundColor: '#f5f5f5', color: '#737373' }}
                            >
                              {service.format}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="w-full space-y-4">
              <input
                type="email"
                placeholder="Email Adresiniz *"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-6 py-4 rounded-xl font-grotesk text-base border-2 focus:outline-none focus:border-gray-400 transition-colors"
                style={{
                  backgroundColor: '#ffffff',
                  borderColor: '#e5e5e5',
                  color: '#171717',
                }}
              />
              <input
                type="tel"
                placeholder="Telefon Numaranız (Opsiyonel)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-6 py-4 rounded-xl font-grotesk text-base border-2 focus:outline-none focus:border-gray-400 transition-colors"
                style={{
                  backgroundColor: '#ffffff',
                  borderColor: '#e5e5e5',
                  color: '#171717',
                }}
              />

              <motion.button
                type="submit"
                disabled={!email.trim() || isSubmitting}
                className="w-full text-white rounded-full px-10 py-5 font-grotesk font-semibold text-lg
                           shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2"
                style={{ backgroundColor: '#171717' }}
                whileHover={email.trim() && !isSubmitting ? {
                  scale: 1.02,
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
                } : {}}
                whileTap={email.trim() && !isSubmitting ? { scale: 0.98 } : {}}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Gönderiliyor...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Raporumu Gönder
                  </>
                )}
              </motion.button>
            </form>

            <p className="text-xs text-center font-grotesk" style={{ color: '#737373' }}>
              Raporunuz {userInfo.businessName} için özel hazırlanmış stratejik öneriler içerecektir.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            className="w-full flex flex-col items-center gap-6 text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#10b981' }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              <Check className="w-10 h-10 text-white" />
            </motion.div>

            <div className="space-y-3">
              <h2 className="text-2xl md:text-3xl font-bold font-grotesk" style={{ color: '#171717' }}>
                Raporunuz Gönderildi! ✓
              </h2>
              <p className="text-base leading-relaxed font-grotesk" style={{ color: '#525252' }}>
                Detaylı strategi raporunuz <strong>{email}</strong> adresine gönderildi.
              </p>
              <p className="text-sm leading-relaxed font-grotesk" style={{ color: '#737373' }}>
                En kısa sürede ekibimiz sizinle iletişime geçecektir.
              </p>
            </div>

            <motion.div
              className="w-full p-6 rounded-xl border-2"
              style={{
                backgroundColor: '#f0fdf4',
                borderColor: '#86efac',
              }}
            >
              <p className="text-sm font-grotesk text-center mb-3" style={{ color: '#15803d' }}>
                <strong>{userInfo.businessName}</strong> için hazırladığımız kapsamlı rapor yakında inbox'unuzda!
              </p>
              {selectedServices.length > 0 && (
                <div className="text-xs font-grotesk text-center" style={{ color: '#16a34a' }}>
                  Seçtiğiniz hizmetler: <strong>{selectedServices.map(id => services.find(s => s.id === id)?.title).join(', ')}</strong>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default OutroQuestion;
