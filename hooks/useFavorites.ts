"use client";
import { useState, useEffect, useCallback } from "react";

const KEY = "archive-favorites";

export function useFavorites() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setIds(JSON.parse(saved));
    } catch {}
  }, []);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [id, ...prev];
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, toggle, isFavorite };
}
