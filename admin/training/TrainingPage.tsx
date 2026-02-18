import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, PlayCircle, FileText, CheckSquare, ExternalLink, Search, Filter } from 'lucide-react';

type ResourceType = 'video' | 'document' | 'checklist' | 'link';

type CategoryKey = 'sosyal_medya' | 'video_produksiyon' | 'fotograf' | 'web_gelistirme' | 'grafik_tasarim' | 'danismanlik';

interface SOPResource {
  id: string;
  type: ResourceType;
  title: string;
  description: string;
  category: CategoryKey;
  isRequired: boolean;
  durationMinutes?: number;
  url: string;
}

const categoryLabels: Record<CategoryKey, string> = {
  sosyal_medya: 'Sosyal Medya',
  video_produksiyon: 'Video Produksiyon',
  fotograf: 'Fotograf',
  web_gelistirme: 'Web Gelistirme',
  grafik_tasarim: 'Grafik Tasarim',
  danismanlik: 'Danismanlik',
};

const categoryColors: Record<CategoryKey, string> = {
  sosyal_medya: 'bg-blue-50 text-blue-700 border-blue-200',
  video_produksiyon: 'bg-red-50 text-red-700 border-red-200',
  fotograf: 'bg-amber-50 text-amber-700 border-amber-200',
  web_gelistirme: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  grafik_tasarim: 'bg-purple-50 text-purple-700 border-purple-200',
  danismanlik: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

const typeIcons: Record<ResourceType, React.ReactNode> = {
  video: <PlayCircle className="w-5 h-5" />,
  document: <FileText className="w-5 h-5" />,
  checklist: <CheckSquare className="w-5 h-5" />,
  link: <ExternalLink className="w-5 h-5" />,
};

const typeLabels: Record<ResourceType, string> = {
  video: 'Video',
  document: 'Dokuman',
  checklist: 'Kontrol Listesi',
  link: 'Harici Kaynak',
};

const typeColors: Record<ResourceType, string> = {
  video: 'bg-rose-50 text-rose-600',
  document: 'bg-sky-50 text-sky-600',
  checklist: 'bg-teal-50 text-teal-600',
  link: 'bg-orange-50 text-orange-600',
};

const mockResources: SOPResource[] = [
  {
    id: '1',
    type: 'video',
    title: 'Instagram Icerik Planlama Rehberi',
    description: 'Instagram icin etkili icerik takvimi olusturma ve planlama sureci.',
    category: 'sosyal_medya',
    isRequired: true,
    durationMinutes: 25,
    url: '#',
  },
  {
    id: '2',
    type: 'checklist',
    title: 'Sosyal Medya Post Onay Kontrol Listesi',
    description: 'Her paylasim oncesi kontrol edilmesi gereken maddeler.',
    category: 'sosyal_medya',
    isRequired: true,
    url: '#',
  },
  {
    id: '3',
    type: 'video',
    title: 'Video Cekimi Temel Ilkeleri',
    description: 'Kamera ayarlari, kadraj ve isik duzeni hakkinda temel bilgiler.',
    category: 'video_produksiyon',
    isRequired: true,
    durationMinutes: 40,
    url: '#',
  },
  {
    id: '4',
    type: 'document',
    title: 'Urun Fotografi Cekim Standartlari',
    description: 'E-ticaret ve katalog cekimleri icin standart isik ve arka plan ayarlari.',
    category: 'fotograf',
    isRequired: false,
    url: '#',
  },
  {
    id: '5',
    type: 'link',
    title: 'React Best Practices 2026',
    description: 'Guncel React gelistirme standartlari ve performans optimizasyonlari.',
    category: 'web_gelistirme',
    isRequired: false,
    url: '#',
  },
  {
    id: '6',
    type: 'document',
    title: 'Marka Kimligi Tasarim Rehberi',
    description: 'Logo, renk paleti ve tipografi secimi icin adim adim rehber.',
    category: 'grafik_tasarim',
    isRequired: true,
    url: '#',
  },
  {
    id: '7',
    type: 'video',
    title: 'Musteri Toplantisi Yonetimi',
    description: 'Etkili musteri toplantilari icin hazirlik ve sunum teknikleri.',
    category: 'danismanlik',
    isRequired: false,
    durationMinutes: 18,
    url: '#',
  },
  {
    id: '8',
    type: 'checklist',
    title: 'Video Teslim Oncesi Kalite Kontrol',
    description: 'Final render oncesi ses, renk ve format kontrol listesi.',
    category: 'video_produksiyon',
    isRequired: true,
    url: '#',
  },
];

const TrainingPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | 'all'>('all');

  const filteredResources = useMemo(() => {
    let resources = mockResources;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      resources = resources.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          r.description.toLowerCase().includes(query)
      );
    }

    if (selectedCategory !== 'all') {
      resources = resources.filter((r) => r.category === selectedCategory);
    }

    return resources;
  }, [searchQuery, selectedCategory]);

  const groupedResources = useMemo(() => {
    const groups: Partial<Record<CategoryKey, SOPResource[]>> = {};

    filteredResources.forEach((resource) => {
      if (!groups[resource.category]) {
        groups[resource.category] = [];
      }
      groups[resource.category]!.push(resource);
    });

    return groups;
  }, [filteredResources]);

  const allCategories = Object.keys(categoryLabels) as CategoryKey[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-grotesk font-bold text-[#1a1a2e]">
          Egitim Merkezi
        </h1>
        <p className="font-grotesk text-neutral-500 mt-1">
          Standart calisma prosedurlerini (SOP) inceleyin ve gelisin.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Kaynak ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-xl font-grotesk text-sm text-[#171717] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-neutral-500" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as CategoryKey | 'all')}
            className="px-4 py-2.5 bg-white border border-neutral-200 rounded-xl font-grotesk text-sm text-[#171717] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="all">Tum Kategoriler</option>
            {allCategories.map((cat) => (
              <option key={cat} value={cat}>
                {categoryLabels[cat]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grouped Resource Cards */}
      {(selectedCategory === 'all' ? allCategories : [selectedCategory]).map((category, catIndex) => {
        const resources = groupedResources[category];

        if (!resources || resources.length === 0) {
          if (selectedCategory !== 'all') {
            return (
              <motion.div
                key={category}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-xl p-12 text-center border border-neutral-100"
              >
                <GraduationCap className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
                <h3 className="font-grotesk text-xl font-bold text-neutral-400 mb-2">
                  Kaynak bulunamadi
                </h3>
                <p className="font-grotesk text-neutral-400">
                  Bu kategori icin aramanizla eslesen kaynak yok.
                </p>
              </motion.div>
            );
          }
          return null;
        }

        return (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: catIndex * 0.1 }}
          >
            <h2 className="font-grotesk text-lg font-bold text-[#171717] mb-4">
              {categoryLabels[category]}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
              {resources.map((resource, index) => (
                <motion.a
                  key={resource.id}
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: catIndex * 0.1 + index * 0.05 }}
                  className="block bg-white rounded-xl border border-neutral-100 p-5 hover:shadow-md hover:border-neutral-200 transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-lg flex-shrink-0 ${typeColors[resource.type]}`}>
                      {typeIcons[resource.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-grotesk text-sm font-semibold text-[#171717] group-hover:text-indigo-600 transition-colors">
                          {resource.title}
                        </h3>
                        {resource.isRequired && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-grotesk font-bold bg-red-50 text-red-600 border border-red-200 uppercase tracking-wide">
                            Zorunlu
                          </span>
                        )}
                      </div>
                      <p className="font-grotesk text-xs text-neutral-500 line-clamp-2 mb-2">
                        {resource.description}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-grotesk font-medium border ${categoryColors[resource.category]}`}>
                          {typeLabels[resource.type]}
                        </span>
                        {resource.type === 'video' && resource.durationMinutes && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-grotesk font-medium bg-neutral-100 text-neutral-600">
                            <PlayCircle className="w-3 h-3" />
                            {resource.durationMinutes} dk
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.a>
              ))}
            </div>
          </motion.div>
        );
      })}

      {/* Global Empty State */}
      {filteredResources.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-xl p-12 text-center border border-neutral-100"
        >
          <GraduationCap className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
          <h3 className="font-grotesk text-xl font-bold text-neutral-400 mb-2">
            Kaynak bulunamadi
          </h3>
          <p className="font-grotesk text-neutral-400">
            Aramanizla eslesen egitim kaynagi yok. Farkli bir arama deneyin.
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default TrainingPage;
