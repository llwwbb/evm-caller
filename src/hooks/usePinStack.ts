import { useCallback, useMemo, useState } from 'react';

export interface PinStackState {
  selectedPath: string | null;
  pinnedPaths: Set<string>;
  collapsedPaths: Set<string>;
}

export interface PinStackActions {
  /** Selection on click. If modifier is pressed, pin the path instead of focusing. */
  clickPath: (path: string, modifier: boolean) => void;
  togglePin: (path: string) => void;
  closeCard: (path: string) => void;
  toggleCollapse: (path: string) => void;
  clearAll: () => void;
  hydrate: (init: {
    selectedPath: string | null;
    pinnedPaths: string[];
    collapsedPaths: string[];
  }) => void;
}

export interface PinStackDerived {
  /**
   * Ordered list of node paths to render in the stack:
   * selectedPath first (if present), then pinned paths excluding the selected.
   */
  cards: string[];
}

export function usePinStack(): PinStackState & PinStackActions & PinStackDerived {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [pinnedPaths, setPinnedPaths] = useState<Set<string>>(new Set());
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());

  const clickPath = useCallback((path: string, modifier: boolean) => {
    if (modifier) {
      setPinnedPaths((prev) => {
        if (prev.has(path)) return prev;
        const next = new Set(prev);
        next.add(path);
        return next;
      });
    } else {
      setSelectedPath(path);
    }
  }, []);

  const togglePin = useCallback((path: string) => {
    setPinnedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const closeCard = useCallback((path: string) => {
    setPinnedPaths((prev) => {
      if (!prev.has(path)) return prev;
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
    setSelectedPath((cur) => (cur === path ? null : cur));
  }, []);

  const toggleCollapse = useCallback((path: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSelectedPath(null);
    setPinnedPaths(new Set());
    setCollapsedPaths(new Set());
  }, []);

  const hydrate = useCallback((init: {
    selectedPath: string | null;
    pinnedPaths: string[];
    collapsedPaths: string[];
  }) => {
    setSelectedPath(init.selectedPath);
    setPinnedPaths(new Set(init.pinnedPaths));
    setCollapsedPaths(new Set(init.collapsedPaths));
  }, []);

  const cards = useMemo<string[]>(() => {
    const out: string[] = [];
    if (selectedPath) out.push(selectedPath);
    for (const p of pinnedPaths) {
      if (p !== selectedPath) out.push(p);
    }
    return out;
  }, [selectedPath, pinnedPaths]);

  return {
    selectedPath,
    pinnedPaths,
    collapsedPaths,
    clickPath,
    togglePin,
    closeCard,
    toggleCollapse,
    clearAll,
    hydrate,
    cards,
  };
}
