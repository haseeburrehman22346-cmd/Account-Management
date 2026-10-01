"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/format";
import { ApiError } from "@/services";

interface FetchState<T> {
  data?: T;
  error?: string;
  status?: number;
}


export function useFetch<T>(fetcher: () => Promise<T>) {
  const [state, setState] = useState<FetchState<T>>({});
  const [version, setVersion] = useState(0);
  const inflight = useRef<{ fetcher: () => Promise<T>; version: number; promise: Promise<T> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // React Strict Mode (dev only) runs this effect twice on mount; reuse the pending
    // request instead of sending a duplicate. A new fetcher or reload() still refetches.
    const current = inflight.current;
    const promise =
      current && current.fetcher === fetcher && current.version === version ? current.promise : fetcher();
    inflight.current = { fetcher, version, promise };

    promise.then(
      (data) => !cancelled && setState({ data }),
      (err) =>
        !cancelled &&
        setState((prev) => ({
          data: prev.data,
          error: errorMessage(err),
          status: err instanceof ApiError ? err.status : undefined,
        })),
    );
    return () => {
      cancelled = true;
    };
  }, [fetcher, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return {
    data: state.data,
    error: state.error,
    status: state.status,
    isLoading: state.data === undefined && state.error === undefined,
    reload,
  };
}
