import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

/**
 * PERF-006: Simple List Virtualization Hook
 * 
 * Renders only visible items plus buffer for smooth scrolling.
 * Use for lists with 50+ items to improve performance.
 * 
 * For more advanced use cases, consider:
 * - react-window (smaller bundle)
 * - @tanstack/react-virtual (more features)
 * 
 * Usage:
 * ```tsx
 * const { virtualItems, totalHeight, containerRef } = useVirtualList({
 *   items: myLargeList,
 *   itemHeight: 80,
 *   overscan: 5,
 * });
 * 
 * return (
 *   <div ref={containerRef} style={{ height: 400, overflow: 'auto' }}>
 *     <div style={{ height: totalHeight, position: 'relative' }}>
 *       {virtualItems.map(({ item, index, style }) => (
 *         <div key={index} style={style}>
 *           {renderItem(item)}
 *         </div>
 *       ))}
 *     </div>
 *   </div>
 * );
 * ```
 */

export interface VirtualListOptions<T> {
  items: T[];
  itemHeight: number;
  overscan?: number;
  enabled?: boolean;
}

export interface VirtualItem<T> {
  item: T;
  index: number;
  style: React.CSSProperties;
}

export interface VirtualListResult<T> {
  virtualItems: VirtualItem<T>[];
  totalHeight: number;
  containerRef: React.RefObject<HTMLDivElement>;
  scrollTo: (index: number) => void;
  isVirtualized: boolean;
}

const VIRTUALIZATION_THRESHOLD = 30;

export function useVirtualList<T>({
  items,
  itemHeight,
  overscan = 3,
  enabled = true,
}: VirtualListOptions<T>): VirtualListResult<T> {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const shouldVirtualize = enabled && items.length > VIRTUALIZATION_THRESHOLD;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !shouldVirtualize) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    const handleResize = () => {
      setContainerHeight(container.clientHeight);
    };

    handleResize();
    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [shouldVirtualize]);

  const { virtualItems, totalHeight } = useMemo(() => {
    const total = items.length * itemHeight;

    if (!shouldVirtualize) {
      return {
        virtualItems: items.map((item, index) => ({
          item,
          index,
          style: {} as React.CSSProperties,
        })),
        totalHeight: total,
      };
    }

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    const visibleItems: VirtualItem<T>[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      visibleItems.push({
        item: items[i],
        index: i,
        style: {
          position: 'absolute',
          top: i * itemHeight,
          left: 0,
          right: 0,
          height: itemHeight,
        },
      });
    }

    return {
      virtualItems: visibleItems,
      totalHeight: total,
    };
  }, [items, itemHeight, scrollTop, containerHeight, overscan, shouldVirtualize]);

  const scrollTo = useCallback((index: number) => {
    if (containerRef.current) {
      containerRef.current.scrollTop = index * itemHeight;
    }
  }, [itemHeight]);

  return {
    virtualItems,
    totalHeight,
    containerRef,
    scrollTo,
    isVirtualized: shouldVirtualize,
  };
}

export default useVirtualList;
