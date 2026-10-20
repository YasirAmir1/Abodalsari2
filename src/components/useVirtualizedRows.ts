import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject, UIEvent } from 'react';

interface VirtualizedRows<T> {
  scrollRef: RefObject<HTMLDivElement>;
  handleScroll: (event: UIEvent<HTMLDivElement>) => void;
  visibleRows: T[];
  topSpacerHeight: number;
  bottomSpacerHeight: number;
}

export function useVirtualizedRows<T>(
  rows: T[],
  rowHeight: number,
  viewportHeight = 650,
  overscan = 8,
  threshold = 80
): VirtualizedRows<T> {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleStart, setVisibleStart] = useState(0);

  useEffect(() => {
    setVisibleStart(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [rows]);

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const firstVisibleRow = Math.floor(event.currentTarget.scrollTop / rowHeight);
    const nextStart = Math.max(0, firstVisibleRow - overscan);
    setVisibleStart((currentStart) => currentStart === nextStart ? currentStart : nextStart);
  }, [overscan, rowHeight]);

  const isVirtualized = rows.length > threshold;
  const start = isVirtualized ? visibleStart : 0;
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  const end = isVirtualized ? Math.min(rows.length, start + visibleCount) : rows.length;

  return {
    scrollRef,
    handleScroll,
    visibleRows: isVirtualized ? rows.slice(start, end) : rows,
    topSpacerHeight: start * rowHeight,
    bottomSpacerHeight: isVirtualized ? Math.max(0, (rows.length - end) * rowHeight) : 0
  };
}
