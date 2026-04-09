import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { RentalCatalogItem } from '@/shared/types/pricing/quotes';

const COLLECTION = 'rental_catalog';

export async function getAllRentalItems(): Promise<RentalCatalogItem[]> {
  if (!db) return [];
  const snap = await getDocs(query(collection(db, COLLECTION)));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RentalCatalogItem));
  return items.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}
