import { Sector } from '@/shared/types/brandLead';

export interface SectorCard {
  id: Sector;
  icon: string;
  title: string;
  description: string;
  color: string;
}

export const SECTOR_CARDS: SectorCard[] = [
  {
    id: 'gastronomi',
    icon: 'ChefHat',
    title: 'Gastronomi',
    description: 'Restoran, kafe, otel, food & beverage',
    color: '#f97316',
  },
  {
    id: 'retail',
    icon: 'ShoppingBag',
    title: 'Perakende',
    description: 'Mağaza, butik, e-ticaret',
    color: '#8b5cf6',
  },
  {
    id: 'corporate',
    icon: 'Building2',
    title: 'Kurumsal',
    description: 'B2B, kurumsal, holding',
    color: '#3b82f6',
  },
  {
    id: 'tech',
    icon: 'Cpu',
    title: 'Teknoloji',
    description: 'Teknoloji, startup, SaaS',
    color: '#10b981',
  },
  {
    id: 'health',
    icon: 'HeartPulse',
    title: 'Sağlık & Wellness',
    description: 'Sağlık, klinik, wellness',
    color: '#ef4444',
  },
  {
    id: 'education',
    icon: 'GraduationCap',
    title: 'Eğitim',
    description: 'Eğitim kurumları, kurslar, akademi',
    color: '#f59e0b',
  },
  {
    id: 'fmcg',
    icon: 'Package',
    title: 'Gıda & FMCG',
    description: 'Gıda, içecek, hızlı tüketim ürünleri',
    color: '#84cc16',
  },
  {
    id: 'showroom',
    icon: 'Lamp',
    title: 'Yapı & Dekorasyon',
    description: 'Yapı malzemeleri, mobilya, dekorasyon, aydınlatma',
    color: '#d97706',
  },
];
