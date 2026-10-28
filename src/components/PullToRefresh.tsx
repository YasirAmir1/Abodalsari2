/**
 * PullToRefresh.tsx - Mobile-First Pull-to-Refresh Component for Cloud Sync
 * Provides touch and gesture support to trigger manual Firestore synchronization
 * with smooth visual indicator and loading spinner UX.
 */

import React, { useState, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown>;
  children: React.ReactNode;
  className?: string;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children, className = '' }) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const threshold = 75;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startYRef.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return;
    const currentY = e.touches[0].clientY;
    const distance = currentY - startYRef.current;
    if (distance > 0) {
      setPullDistance(Math.min(distance * 0.45, 110));
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling) return;
    setIsPulling(false);
    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPullDistance(0);
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative overflow-y-auto ${className}`}
    >
      {/* Pull indicator / Spinner */}
      {(pullDistance > 0 || refreshing) && (
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center bg-sky-50/90 dark:bg-slate-800/95 text-sky-700 dark:text-sky-300 transition-all z-20 py-2.5 border-b border-sky-100 dark:border-slate-700 shadow-xs backdrop-blur-xs"
          style={{ height: `${Math.max(pullDistance, refreshing ? 48 : 0)}px` }}
        >
          <div className="flex items-center gap-2 text-xs font-bold">
            <RefreshCw className={`w-4 h-4 text-sky-600 dark:text-sky-400 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'جاري تحديث المزامنة السحابية...' : pullDistance >= threshold ? 'أفلت للتحديث الآن' : 'اسحب لأسفل للتحديث'}</span>
          </div>
        </div>
      )}

      {children}
    </div>
  );
};
