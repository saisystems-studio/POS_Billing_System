import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_WIDTH = 54;
const textOf = cell => (cell?.getAttribute('data-autofit-value') || cell?.innerText || cell?.textContent || '')
  .replace(/\s+/g, ' ').trim();
const isVisible = element => {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
};
const maximumFor = header => /product.*name|particular|description/i.test(textOf(header)) ? 1000
  : /group/i.test(textOf(header)) ? 400 : 600;
const minimumFor = header => /checkbox|select/i.test(header.className) ? 45
  : /s\.?no|qty|quantity|gst/i.test(textOf(header)) ? 60
    : /status/i.test(textOf(header)) ? 110 : MIN_WIDTH;

const AutoFitIcon = () => (
  <svg className="auto-fit-columns-icon" viewBox="0 0 32 22" aria-hidden="true" focusable="false">
    <path d="M3.5 2v18M28.5 2v18" />
    <path d="M7 11h18M7 11l4-4M7 11l4 4M25 11l-4-4M25 11l-4 4" />
  </svg>
);

const AutoFitColumns = ({ tableRef }) => {
  const [isAutoFitMode, setIsAutoFitMode] = useState(false);
  const selected = useRef(new Set());
  const selectionAnchor = useRef(null);
  const selecting = useRef(false);
  const drag = useRef(null);
  const originals = useRef(new WeakMap());
  const fittedColumns = useRef(new Set());
  const shortcut = useRef({ step: 0, timer: null });
  const getTable = useCallback(() => tableRef?.current || null, [tableRef]);

  const remember = element => {
    if (!element || originals.current.has(element)) return;
    originals.current.set(element, {
      width: element.style.width,
      widthPriority: element.style.getPropertyPriority('width'),
      minWidth: element.style.minWidth,
      minWidthPriority: element.style.getPropertyPriority('min-width'),
      maxWidth: element.style.maxWidth,
      maxWidthPriority: element.style.getPropertyPriority('max-width'),
      tableLayout: element.style.tableLayout,
      tableLayoutPriority: element.style.getPropertyPriority('table-layout'),
    });
  };
  const restoreElement = element => {
    const value = originals.current.get(element);
    if (value) {
      value.width ? element.style.setProperty('width', value.width, value.widthPriority) : element.style.removeProperty('width');
      value.minWidth ? element.style.setProperty('min-width', value.minWidth, value.minWidthPriority) : element.style.removeProperty('min-width');
      value.maxWidth ? element.style.setProperty('max-width', value.maxWidth, value.maxWidthPriority) : element.style.removeProperty('max-width');
      value.tableLayout ? element.style.setProperty('table-layout', value.tableLayout, value.tableLayoutPriority) : element.style.removeProperty('table-layout');
    } else if (element) {
      element.style.removeProperty('width');
      element.style.removeProperty('min-width');
      element.style.removeProperty('max-width');
    }
  };
  const cellsFor = (table, index) => [...table.rows].map(row => row.cells[index]).filter(cell => cell && isVisible(cell));

  const setSelected = useCallback(next => {
    selected.current = next;
    const table = getTable();
    [...(table?.tHead?.rows?.[0]?.cells || [])].forEach((header, index) => {
      const active = next.has(index);
      header.classList.toggle('column-selected', active);
      header.setAttribute('aria-selected', String(active));
    });
  }, [getTable]);

  const measureColumn = useCallback(index => {
    const table = getTable();
    const header = table?.tHead?.rows?.[0]?.cells?.[index];
    if (!table || !header || !isVisible(header)) return null;
    let measured = minimumFor(header);
    cellsFor(table, index).forEach(cell => {
      const style = window.getComputedStyle(cell);
      const context = document.createElement('canvas').getContext('2d');
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const horizontalPadding = parseFloat(style.paddingLeft || 0) + parseFloat(style.paddingRight || 0);
      const content = textOf(cell);
      const nonTextWidth = [...cell.children].reduce((sum, child) => {
        const childText = (child.innerText || child.textContent || '').trim();
        return sum + (childText ? 0 : child.getBoundingClientRect().width);
      }, 0);
      measured = Math.max(measured, context.measureText(content).width + horizontalPadding + nonTextWidth + 18);
      if (content && !cell.title) cell.title = content;
    });
    return Math.min(maximumFor(header), Math.ceil(measured));
  }, [getTable]);

  const applyWidth = useCallback((index, width) => {
    const table = getTable();
    if (!table || width == null) return;
    const col = table.querySelector(`colgroup col:nth-child(${index + 1})`);
    if (col) {
      remember(col);
      col.style.setProperty('width', `${width}px`, 'important');
      col.style.setProperty('min-width', `${width}px`, 'important');
      col.style.setProperty('max-width', `${width}px`, 'important');
    }
    cellsFor(table, index).forEach(cell => {
      remember(cell);
      cell.style.setProperty('width', `${width}px`, 'important');
      cell.style.setProperty('min-width', `${width}px`, 'important');
      cell.style.setProperty('max-width', `${width}px`, 'important');
    });
    fittedColumns.current.add(index);
  }, [getTable]);

  const enterExpandedMode = useCallback(() => {
    const table = getTable();
    if (!table) return;
    remember(table);
    table.classList.add('auto-fit-mode');
    table.classList.remove('compact-mode');
    table.style.setProperty('table-layout', 'fixed', 'important');
    table.style.setProperty('width', 'max-content', 'important');
    table.style.setProperty('min-width', '100%', 'important');
    table.closest('.table-wrapper, .table-wrapper-scroll, .sales-entry-table-wrap, .desktop-table-view')
      ?.classList.add('auto-fit-scroll-active');
    setIsAutoFitMode(true);
  }, [getTable]);

  const autoFitColumns = useCallback(indices => {
    const table = getTable();
    if (!table) return;
    enterExpandedMode();
    indices.forEach(index => applyWidth(index, measureColumn(index)));
  }, [applyWidth, enterExpandedMode, getTable, measureColumn]);

  const targetColumns = useCallback(() => {
    const table = getTable();
    if (selected.current.size) return [...selected.current];
    return [...(table?.tHead?.rows?.[0]?.cells || [])].map((_, index) => index)
      .filter(index => isVisible(table.tHead.rows[0].cells[index]));
  }, [getTable]);

  const restoreCompact = useCallback(() => {
    const table = getTable();
    if (!table) return;
    fittedColumns.current.forEach(index => {
      const col = table.querySelector(`colgroup col:nth-child(${index + 1})`);
      restoreElement(col);
      cellsFor(table, index).forEach(restoreElement);
    });
    restoreElement(table);
    table.classList.remove('auto-fit-mode');
    table.classList.add('compact-mode');
    table.closest('.auto-fit-scroll-active')?.classList.remove('auto-fit-scroll-active');
    fittedColumns.current.clear();
    setIsAutoFitMode(false);
  }, [getTable]);

  const toggleAutoFit = useCallback(() => {
    if (isAutoFitMode) restoreCompact();
    else autoFitColumns(targetColumns());
  }, [autoFitColumns, isAutoFitMode, restoreCompact, targetColumns]);

  useEffect(() => {
    const table = getTable();
    if (!table) return undefined;
    const headers = () => [...(table.tHead?.rows?.[0]?.cells || [])];
    const updateSelection = (index, event = {}) => {
      let next = new Set(selected.current);
      if (event.shiftKey && selectionAnchor.current != null) {
        next = new Set();
        const [start, end] = [selectionAnchor.current, index].sort((a, b) => a - b);
        for (let i = start; i <= end; i += 1) next.add(i);
      } else if (event.ctrlKey || event.metaKey) {
        next.has(index) ? next.delete(index) : next.add(index);
        selectionAnchor.current = index;
      } else {
        next = new Set([index]);
        selectionAnchor.current = index;
      }
      setSelected(next);
    };
    const addHandles = () => headers().forEach((header, index) => {
      header.tabIndex = header.tabIndex < 0 ? 0 : header.tabIndex;
      if (!header.dataset.columnSelectionBound) {
        header.dataset.columnSelectionBound = 'true';
        header.addEventListener('pointerdown', event => {
          if (event.target.closest('.column-resize-handle')) return;
          event.preventDefault();
          selecting.current = true;
          updateSelection(index, event);
        });
        header.addEventListener('pointerenter', event => {
          if (!selecting.current || selectionAnchor.current == null) return;
          const next = new Set();
          const [start, end] = [selectionAnchor.current, index].sort((a, b) => a - b);
          for (let i = start; i <= end; i += 1) next.add(i);
          setSelected(next);
          event.preventDefault();
        });
      }
      if (header.querySelector(':scope > .column-resize-handle')) return;
      header.classList.add('resizable-column-header');
      const handle = document.createElement('span');
      handle.className = 'column-resize-handle';
      handle.setAttribute('role', 'separator');
      handle.setAttribute('aria-label', `Resize ${textOf(header) || `column ${index + 1}`}`);
      handle.addEventListener('dblclick', event => {
        event.preventDefault();
        event.stopPropagation();
        const indices = selected.current.has(index) && selected.current.size ? [...selected.current] : [index];
        autoFitColumns(indices);
      });
      handle.addEventListener('pointerdown', event => {
        event.preventDefault();
        event.stopPropagation();
        handle.setPointerCapture?.(event.pointerId);
        drag.current = { index, startX: event.clientX, startWidth: header.getBoundingClientRect().width };
      });
      handle.addEventListener('pointermove', event => {
        if (!drag.current || drag.current.index !== index) return;
        enterExpandedMode();
        applyWidth(index, Math.max(minimumFor(header), drag.current.startWidth + event.clientX - drag.current.startX));
      });
      handle.addEventListener('pointerup', () => { drag.current = null; });
      header.appendChild(handle);
    });
    const stopSelecting = () => { selecting.current = false; };
    const refresh = () => requestAnimationFrame(() => {
      addHandles();
      if (isAutoFitMode) autoFitColumns(targetColumns());
    });
    addHandles();
    const observer = new MutationObserver(refresh);
    observer.observe(table.tBodies[0] || table, { childList: true, subtree: true });
    const resizeTarget = table.closest('.table-wrapper, .table-wrapper-scroll, .sales-entry-table-wrap, .desktop-table-view') || table;
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(refresh) : null;
    resizeObserver?.observe(resizeTarget);
    window.addEventListener('pointerup', stopSelecting);
    return () => {
      observer.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('pointerup', stopSelecting);
    };
  }, [applyWidth, autoFitColumns, enterExpandedMode, getTable, isAutoFitMode, setSelected, targetColumns]);

  useEffect(() => {
    const reset = () => {
      clearTimeout(shortcut.current.timer);
      shortcut.current = { step: 0, timer: null };
    };
    const keydown = event => {
      const typing = event.target?.matches?.('input, textarea, select, [contenteditable="true"]');
      if (typing || document.querySelector('.modal-overlay, [role="dialog"]')) return reset();
      if (event.key === 'Alt' && !event.ctrlKey && !event.metaKey) {
        shortcut.current.step = 1;
        clearTimeout(shortcut.current.timer);
        shortcut.current.timer = setTimeout(reset, 1800);
        return;
      }
      if (!shortcut.current.step || event.altKey || event.ctrlKey || event.metaKey) return;
      const expected = ['h', 'o', 'i'][shortcut.current.step - 1];
      if (event.key.toLowerCase() !== expected) return reset();
      event.preventDefault();
      shortcut.current.step += 1;
      clearTimeout(shortcut.current.timer);
      if (shortcut.current.step === 4) {
        toggleAutoFit();
        reset();
      } else shortcut.current.timer = setTimeout(reset, 1800);
    };
    window.addEventListener('keydown', keydown);
    return () => {
      reset();
      window.removeEventListener('keydown', keydown);
    };
  }, [toggleAutoFit]);

  return (
    <button type="button" className={`btn btn-outline-secondary btn-sm auto-fit-columns-button${isAutoFitMode ? ' active' : ''}`}
      onClick={toggleAutoFit} aria-pressed={isAutoFitMode}
      aria-label="Auto Fit Columns" title="Auto Fit" data-focus-tooltip="Auto Fit Columns">
      <AutoFitIcon />
      <span className="visually-hidden">Auto Fit Columns</span>
    </button>
  );
};

export default AutoFitColumns;
