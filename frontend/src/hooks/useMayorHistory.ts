import { useState, useEffect } from 'react';
import { fetchCityContext } from '../services/api';
import type { MayorTerm } from '../services/api';

export type { MayorTerm };

export function useMayorHistory(cityId: number | null): {
  terms: MayorTerm[];
  loading: boolean;
  error: string | null;
} {
  const [terms, setTerms] = useState<MayorTerm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cityId === null) {
      setTerms([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchCityContext(cityId)
      .then(ctx => {
        if (cancelled) return;
        setTerms(ctx.mayors);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error al cargar la historia de alcaldes');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cityId]);

  return { terms, loading, error };
}
