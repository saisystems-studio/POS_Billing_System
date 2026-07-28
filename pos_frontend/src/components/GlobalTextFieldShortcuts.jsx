import { useEffect } from 'react';

const fieldSelector = [
  'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"])',
  'select',
  'textarea',
  '[data-escape-clear="true"]',
].join(',');

const isUsable = element => {
  if (!element?.matches?.(fieldSelector) || element.disabled || element.readOnly) return false;
  if (element.getAttribute('aria-disabled') === 'true' || element.tabIndex < 0) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden'
    && element.getClientRects().length > 0;
};

const scopeFor = target =>
  target.closest('.modal-overlay, [role="dialog"]')
  || target.closest('form')
  || target.closest('main, .content-inner')
  || document.body;

const orderedFields = target => [...scopeFor(target).querySelectorAll(fieldSelector)]
  .filter(isUsable)
  .sort((a, b) => {
    const aOrder = Number(a.dataset.navOrder);
    const bOrder = Number(b.dataset.navOrder);
    if (Number.isFinite(aOrder) && Number.isFinite(bOrder)) return aOrder - bOrder;
    if (Number.isFinite(aOrder)) return -1;
    if (Number.isFinite(bOrder)) return 1;
    const position = a.compareDocumentPosition(b);
    return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });

const move = (target, direction) => {
  const fields = orderedFields(target);
  const index = fields.indexOf(target);
  const next = fields[index + direction];
  if (!next) return false;
  next.focus({ preventScroll: false });
  if (next.select && next.matches('input:not([type="date"]), textarea')) next.select();
  return true;
};

const setNativeValue = (element, value) => {
  const prototype = element instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
};

const clearField = target => {
  if (target.matches('[data-escape-clear="true"]') || target.dataset.salesRate === 'true') {
    target.dispatchEvent(new CustomEvent('pos-escape-clear-field', {
      bubbles: true,
      detail: { source: target },
    }));
  }
  if ('value' in target && target.value !== '') {
    setNativeValue(target, '');
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  }
  requestAnimationFrame(() => target.focus?.());
};

const isTextInput = target => target.matches('input:not([type="checkbox"]):not([type="radio"]), textarea');
const hasPartialTextEdit = target => {
  if (!isTextInput(target) || target instanceof HTMLInputElement && ['date', 'number'].includes(target.type)) return false;
  const start = target.selectionStart;
  const end = target.selectionEnd;
  if (start == null || end == null) return false;
  return (start !== end && !(start === 0 && end === target.value.length)) || start > 0;
};

const GlobalTextFieldShortcuts = () => {
  useEffect(() => {
    const submitting = new WeakSet();
    const handler = event => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
        && event.key.toLowerCase() === 's') {
        const modal = document.querySelector('.modal-overlay, [role="dialog"]');
        const scope = modal || target.closest('form');
        if (!scope || (modal && !modal.contains(target))) return;
        const form = scope.matches?.('form') ? scope : scope.querySelector('form');
        const save = scope.querySelector(
          'button[type="submit"]:not([disabled]), input[type="submit"]:not([disabled]), [data-save-action="true"]:not([disabled])'
        );
        if (!save || !form || submitting.has(form)) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.repeat) return;
        submitting.add(form);
        form.addEventListener('submit', () => setTimeout(() => submitting.delete(form), 1000), { once: true });
        save.click();
        setTimeout(() => submitting.delete(form), 3000);
        return;
      }

      if (!isUsable(target)) return;
      const billingManaged = Boolean(target.closest('[data-billing-grid="true"], [data-billing-field="true"]'));
      const dropdownOpen = Boolean(document.querySelector('[data-sales-dropdown-open="true"]'));

      if (event.key === 'Escape') {
        if (target.closest('[role="listbox"]') || dropdownOpen) return;
        event.preventDefault();
        event.stopPropagation();
        clearField(target);
        return;
      }

      if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (billingManaged || dropdownOpen || target.matches('textarea, input[type="checkbox"], input[type="radio"]')) return;
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) move(target, 1);
        return;
      }

      if (event.key === 'Backspace' && !event.altKey && !event.ctrlKey && !event.metaKey) {
        if (billingManaged || target.matches('textarea') && target.value !== '' || hasPartialTextEdit(target)) return;
        event.preventDefault();
        event.stopPropagation();
        if ('value' in target && target.value !== '') clearField(target);
        else move(target, -1);
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);
  return null;
};

export default GlobalTextFieldShortcuts;
