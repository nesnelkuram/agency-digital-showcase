/**
 * Kiralık Kamera 724 Ekipman Verileri
 * Kaynak: https://kiralikkamera724.com/
 */

import { collection, addDoc, Timestamp, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Equipment, EquipmentCategory, CostStatus } from '@/shared/types/pricing';

interface RentalEquipmentData {
  name: string;
  category: EquipmentCategory;
  rentalValueDaily: number;
  notes?: string;
}

// Kamera Setleri
const CAMERA_SETS: RentalEquipmentData[] = [
  { name: 'Sony FX3/A7S III Ekonomik Set', category: 'camera', rentalValueDaily: 2250 },
  { name: 'Sony FX3/A7S III Eko Plus Set', category: 'camera', rentalValueDaily: 2750 },
  { name: 'Sony FX3/A7S III Pratik Eko Set', category: 'camera', rentalValueDaily: 3000 },
  { name: 'Sony FX3/A7S III Kamera Seti', category: 'camera', rentalValueDaily: 4500 },
  { name: 'Sony FX3/A7S III Cine Setup', category: 'camera', rentalValueDaily: 4500 },
  { name: 'Sony FX3/A7S III Anamorphic Cine Set', category: 'camera', rentalValueDaily: 4500 },
  { name: 'Sony FX3/A7S III G Master Prime Set', category: 'camera', rentalValueDaily: 5500 },
  { name: 'Sony FX6 AutoFocus Set', category: 'camera', rentalValueDaily: 5000 },
  { name: 'Sony FX6 Anamorphic Cine Set', category: 'camera', rentalValueDaily: 5000 },
  { name: 'Sony FX6 Cine Setup', category: 'camera', rentalValueDaily: 6000 },
  { name: 'Sony FX6 G Master Prime Set', category: 'camera', rentalValueDaily: 6250 },
  { name: 'Sony FX6 Cooke SP3 FF Cine Setup', category: 'camera', rentalValueDaily: 7000 },
  { name: 'Sony FX9 Cine Setup', category: 'camera', rentalValueDaily: 6500 },
  { name: 'Sony FX9 G Master Prime Set', category: 'camera', rentalValueDaily: 7000 },
  { name: 'Sony FX9 Cooke SP3 FF Cine Setup', category: 'camera', rentalValueDaily: 7250 },
  { name: 'Sony A7R V Kamera Seti', category: 'camera', rentalValueDaily: 5000 },
  { name: 'Red Komodo 6K Cine Setup', category: 'camera', rentalValueDaily: 5000 },
  { name: 'Sony Burano AutoFocus Set', category: 'camera', rentalValueDaily: 9000 },
  { name: 'Sony Burano G Master Prime Set', category: 'camera', rentalValueDaily: 9000 },
  { name: 'Sony Burano Cine Setup', category: 'camera', rentalValueDaily: 10000 },
  { name: 'Sony Burano Cooke SP3 FF Cine Setup', category: 'camera', rentalValueDaily: 11000 },
  { name: 'Sony Burano DZO Arles Prime Cine Setup', category: 'camera', rentalValueDaily: 11000 },
  { name: 'RED V-RAPTOR XL Cine Setup 2', category: 'camera', rentalValueDaily: 10000 },
  { name: 'RED V-RAPTOR XL Cine Setup 1', category: 'camera', rentalValueDaily: 12000 },
  { name: 'DJI Ronin 4D 8K Kamera Seti', category: 'camera', rentalValueDaily: 12000 },
  { name: 'Fujifilm X-H2S/X-T5 Kamera Seti', category: 'camera', rentalValueDaily: 3000 },
];

// Fotograf Setleri
const PHOTOGRAPHY_SETS: RentalEquipmentData[] = [
  { name: 'Wedding Fotograf Seti', category: 'camera', rentalValueDaily: 3000, notes: 'Fotograf' },
  { name: 'Wedding Fotograf + Plus Seti', category: 'camera', rentalValueDaily: 3250, notes: 'Fotograf' },
  { name: 'Fuji Profesyonel Fotograf Seti', category: 'camera', rentalValueDaily: 3000, notes: 'Fotograf' },
  { name: 'Fuji Profesyonel + Plus Fotograf Seti', category: 'camera', rentalValueDaily: 3000, notes: 'Fotograf' },
  { name: 'Canon Profesyonel Fotograf Seti', category: 'camera', rentalValueDaily: 4500, notes: 'Fotograf' },
  { name: 'Profesyonel Fotograf Seti', category: 'camera', rentalValueDaily: 5500, notes: 'Fotograf' },
  { name: 'Sony Profesyonel Fotograf Seti', category: 'camera', rentalValueDaily: 6000, notes: 'Fotograf' },
  { name: 'Profesyonel Fotograf + Plus Seti', category: 'camera', rentalValueDaily: 6000, notes: 'Fotograf' },
];

// Isik Setleri
const LIGHTING_SETS: RentalEquipmentData[] = [
  { name: 'Isik Aksesuarlari Seti', category: 'lighting', rentalValueDaily: 1000 },
  { name: 'Mobil Isik Seti', category: 'lighting', rentalValueDaily: 1500 },
  { name: 'Nanlite Forza 720B 2li Bi-Color LED Seti', category: 'lighting', rentalValueDaily: 2750 },
  { name: 'Nanlite RGB Isik Seti', category: 'lighting', rentalValueDaily: 3000 },
  { name: 'Mobil RGB PavoTube II Isik Seti', category: 'lighting', rentalValueDaily: 4000 },
  { name: 'Nanlux Evoke 900C RGB 2li Set', category: 'lighting', rentalValueDaily: 4500 },
  { name: 'Nanlux Evoke 1200D 2li Set', category: 'lighting', rentalValueDaily: 4500 },
];

// Ses Ekipmanlari
const AUDIO_SETS: RentalEquipmentData[] = [
  { name: 'Ses Ekipmanlari Setup 3', category: 'audio', rentalValueDaily: 2000 },
  { name: 'Rode Podcast Ses Setup 2', category: 'audio', rentalValueDaily: 2500 },
  { name: 'Swit Wireless Setup 1', category: 'audio', rentalValueDaily: 2500 },
  { name: 'Hollyland Wireless Setup 2', category: 'audio', rentalValueDaily: 3500 },
  { name: 'Ses Ekipmanlari Setup 2', category: 'audio', rentalValueDaily: 3500 },
  { name: 'Vaxis Wireless Setup 2', category: 'audio', rentalValueDaily: 3500 },
  { name: 'Rode Podcast Ses Setup 1', category: 'audio', rentalValueDaily: 3750 },
  { name: 'Hollyland Wireless Setup 1', category: 'audio', rentalValueDaily: 4000 },
  { name: 'Ses Ekipmanlari Setup 1', category: 'audio', rentalValueDaily: 4000 },
  { name: 'Vaxis Wireless Setup 1', category: 'audio', rentalValueDaily: 4500 },
];

// Tum ekipmanlar
export const ALL_RENTAL_EQUIPMENT: RentalEquipmentData[] = [
  ...CAMERA_SETS,
  ...PHOTOGRAPHY_SETS,
  ...LIGHTING_SETS,
  ...AUDIO_SETS,
];

/**
 * Ekipmanlari Firestore'a ekle
 */
export async function seedRentalEquipment(): Promise<{ added: number; skipped: number }> {
  if (!db) {
    throw new Error('Firebase baglantisi bulunamadi');
  }

  let added = 0;
  let skipped = 0;

  for (const item of ALL_RENTAL_EQUIPMENT) {
    // Check if already exists
    const existingQuery = query(
      collection(db, 'pricing', 'data', 'equipment'),
      where('name', '==', item.name)
    );
    const existingDocs = await getDocs(existingQuery);

    if (!existingDocs.empty) {
      skipped++;
      continue;
    }

    const equipment: Omit<Equipment, 'id'> = {
      name: item.name,
      category: item.category,
      purchasePrice: 0, // Kiralik, satin alinmamis
      costMethod: 'rental_value',
      rentalValueDaily: item.rentalValueDaily,
      status: 'real' as CostStatus,
      isActive: true,
      notes: item.notes || 'Kaynak: kiralikkamera724.com',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await addDoc(collection(db, 'pricing', 'data', 'equipment'), equipment);
    added++;
  }

  return { added, skipped };
}

/**
 * Kategori bazli ekipman listesi
 */
export function getEquipmentByCategory(category: EquipmentCategory): RentalEquipmentData[] {
  return ALL_RENTAL_EQUIPMENT.filter((e) => e.category === category);
}

/**
 * Fiyat araligina gore ekipman listesi
 */
export function getEquipmentByPriceRange(
  minPrice: number,
  maxPrice: number
): RentalEquipmentData[] {
  return ALL_RENTAL_EQUIPMENT.filter(
    (e) => e.rentalValueDaily >= minPrice && e.rentalValueDaily <= maxPrice
  );
}
