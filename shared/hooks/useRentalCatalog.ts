import { useState, useEffect, useMemo } from 'react';
import { RentalCatalogItem } from '@/shared/types/pricing/quotes';
import { getAllRentalItems } from '@/shared/services/rentalCatalogService';

export function useRentalCatalog() {
  const [items, setItems] = useState<RentalCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    getAllRentalItems()
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    map.set('all', 'Tümü');
    for (const item of items) {
      if (!map.has(item.category)) {
        map.set(item.category, item.categoryLabel);
      }
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (selectedCategory !== 'all') {
      result = result.filter((i) => i.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((i) => i.name.toLowerCase().includes(q));
    }
    return result;
  }, [items, selectedCategory, searchQuery]);

  return { items: filtered, loading, categories, searchQuery, setSearchQuery, selectedCategory, setSelectedCategory };
}
