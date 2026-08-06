import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Calculates the number of complete rows/cards that fit below a table area's
 * top edge and above its pagination/summary block.
 */
export default function useResponsivePageSize({
  minRows = 5,
  maxRows = 50,
  defaultRowHeight = 36,
  mobileRowHeight = 220,
  mobilePageSize = null,
  safeSpacing = 16,
  reservedBottomSpace = 0,
  debounceMs = 200,
} = {}) {
  const [pageSize, setPageSize] = useState(minRows);
  const containerRef = useRef(null);
  const rowRef = useRef(null);
  const bottomRef = useRef(null);
  const timerRef = useRef(null);

  const calculate = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const top = Math.max(0, container.getBoundingClientRect().top);
    const bottomNode = bottomRef.current;
    const summaryHeight = bottomNode?.previousElementSibling?.classList?.contains('sales-report-fixed-total')
      ? bottomNode.previousElementSibling.getBoundingClientRect().height
      : 0;
    const bottomHeight = (bottomNode?.getBoundingClientRect().height || 48) + summaryHeight + reservedBottomSpace;
    const renderedRows = [
      ...container.querySelectorAll('tbody > tr:not([class*="empty"]), [class*="mobile-product-row"], [class*="mobile-record-row"], [class*="mobile-card"]'),
    ];
    const measuredRowHeight = Math.max(
      rowRef.current?.getBoundingClientRect().height || 0,
      ...renderedRows.map(row => row.getBoundingClientRect().height),
    );
    const tableHeaderHeight = container.querySelector('thead')?.getBoundingClientRect().height || 0;
    const viewportWidth = window.visualViewport?.width || window.innerWidth;
    const isMobile = viewportWidth < 768;
    const fallbackHeight = isMobile ? Math.min(mobileRowHeight, 64) : defaultRowHeight;
    const rowHeight = measuredRowHeight > 8 ? measuredRowHeight : fallbackHeight;

    const available = Math.max(rowHeight, viewportHeight - top - tableHeaderHeight - bottomHeight - safeSpacing);
    const categoryMax = viewportWidth >= 1600 ? 30
      : viewportWidth >= 1280 ? 20
        : viewportWidth >= 1024 ? 15
          : viewportWidth >= 768 ? 12
            : viewportWidth >= 430 ? 8 : 6;
    const categoryMin = isMobile ? (viewportWidth < 430 ? 4 : 6) : minRows;
    const next = isMobile && Number.isFinite(mobilePageSize)
      ? clamp(mobilePageSize, Math.min(categoryMin, maxRows), Math.min(maxRows, categoryMax))
      : clamp(Math.floor(available / rowHeight), Math.min(categoryMin, maxRows), Math.min(maxRows, categoryMax));
    setPageSize(current => current === next ? current : next);
  }, [defaultRowHeight, maxRows, minRows, mobilePageSize, mobileRowHeight, reservedBottomSpace, safeSpacing]);

  const schedule = useCallback(() => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(calculate, debounceMs);
  }, [calculate, debounceMs]);

  useLayoutEffect(() => {
    calculate();
  }, [calculate]);

  useEffect(() => {
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    [containerRef.current, bottomRef.current].filter(Boolean).forEach(node => observer?.observe(node));
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    window.visualViewport?.addEventListener('resize', schedule);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.clearTimeout(timerRef.current);
    };
  }, [schedule]);

  return { pageSize, containerRef, rowRef, bottomRef, recalculatePageSize: schedule };
}
