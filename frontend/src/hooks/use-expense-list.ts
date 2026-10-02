"use client";

import { useCallback, useState } from "react";
import { expensesService } from "@/services";
import { useDebouncedValue } from "./use-debounced-value";
import { useFetch } from "./use-fetch";

/** Search + pagination state for an expense table, optionally scoped to one category. */
export function useExpenseList({
  categoryId,
  limit = 10,
  initialQuery = "",
}: {
  categoryId?: string;
  limit?: number;
  initialQuery?: string;
} = {}) {
  const [query, setQueryState] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const [seed, setSeed] = useState(initialQuery);
  if (seed !== initialQuery) {
    setSeed(initialQuery);
    setQueryState(initialQuery);
    setPage(1);
  }
  const debounced = useDebouncedValue(query.trim());

  const fetcher = useCallback(
    () => expensesService.search({ categoryId, q: debounced, page, limit }),
    [categoryId, debounced, page, limit],
  );
  const result = useFetch(fetcher);

  const setQuery = useCallback((q: string) => {
    setQueryState(q);
    setPage(1);
  }, []);

  return { ...result, query, setQuery, page, setPage, limit };
}
