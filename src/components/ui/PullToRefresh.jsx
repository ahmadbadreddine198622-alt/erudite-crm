import React, { useCallback, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';

/**
 * PullToRefresh wrapper — native-style iOS pull-to-refresh using Framer Motion.
 * Wrap any scrollable content and provide onRefresh callback.
 */
export default function PullToRefresh({ children, onRefresh, threshold = 100 }) {
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const currentY = useMotionValue(0);
  const opacity = useTransform(currentY, [0, threshold], [0, 1]);
  const scale = useTransform(currentY, [0, threshold], [0.8, 1]);

  const handleTouchStart = useCallback((e) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (startY.current > 0) {
      const deltaY = e.touches[0].clientY - startY.current;
      if (deltaY > 0) {
        e.preventDefault();
        currentY.set(Math.min(deltaY, threshold + 50));
        setPullDistance(Math.min(deltaY, threshold));
      }
    }
  }, [currentY, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    currentY.set(0);
    setPullDistance(0);
    startY.current = 0;
  }, [pullDistance, threshold, refreshing, onRefresh, currentY]);

  return (
    <div
      className="relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Refresh indicator */}
      <motion.div
        className="absolute top-0 left-0 right-0 flex items-center justify-center py-3 z-50 pointer-events-none"
        style={{ opacity, scale }}
      >
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full"
          style={{
            background: 'rgba(245,158,11,0.15)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(245,158,11,0.3)',
          }}
        >
          <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          <span className="text-xs font-semibold" style={{ color: 'hsl(38 92% 50%)' }}>
            {refreshing ? 'Refreshing...' : 'Release to refresh'}
          </span>
        </div>
      </motion.div>

      {/* Content with pull transform */}
      <motion.div
        className="relative"
        style={{ y: refreshing ? 0 : currentY }}
      >
        {children}
      </motion.div>
    </div>
  );
}