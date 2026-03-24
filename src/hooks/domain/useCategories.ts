import { useEffect, useState } from 'react';
import { SUPABASE_API } from '../../lib/supabase';

export function useCategories(): string[] {
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    SUPABASE_API.fetchDistinctCategories().then(setCategories);
  }, []);

  return categories;
}
