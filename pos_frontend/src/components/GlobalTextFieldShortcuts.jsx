import { useEffect } from 'react';

const editableSelector = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]), textarea';
const selectSelector = 'select';
const clearableDropdownSelector = '[data-escape-clear="true"]';

const setNativeValue = (element, value) => {
  const proto = element instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(element, value);
};

const isEditableTextField = element => {
  if (!element?.matches?.(editableSelector)) return false;
  if (element.disabled || element.readOnly) return false;
  const type = (element.getAttribute('type') || 'text').toLowerCase();
  return !['hidden', 'file', 'range', 'color', 'date', 'datetime-local', 'month', 'time', 'week'].includes(type);
};

const isEditableSelect = element => {
  if (!element?.matches?.(selectSelector)) return false;
  return !element.disabled;
};

const dispatchEscapeClear = element => {
  element.dispatchEvent(new CustomEvent('pos-escape-clear-field', {
    bubbles: true,
    detail: { source: element },
  }));
};

const GlobalTextFieldShortcuts = () => {
  useEffect(() => {
    const handler = event => {
      if (event.key !== 'Escape') return;
      if (event.defaultPrevented) return;

      /* Closing a modal or the mobile sidebar takes priority over
         clearing a field that happens to retain focus behind it. */
      if (document.querySelector('.modal-overlay')) return;
      if (document.querySelector('.sidebar.open')) return;

      const target = event.target;
      const dropdownTarget = target?.closest?.(clearableDropdownSelector);

      if (
        dropdownTarget &&
        !dropdownTarget.disabled &&
        dropdownTarget.getAttribute?.('aria-disabled') !== 'true'
      ) {
        event.preventDefault();
        event.stopPropagation();
        dispatchEscapeClear(dropdownTarget);
        setTimeout(() => dropdownTarget.focus?.(), 0);
        return;
      }

      if (target?.dataset?.salesRate === 'true' && !target.disabled) {
        event.preventDefault();
        event.stopPropagation();
        dispatchEscapeClear(target);
        setTimeout(() => target.focus?.(), 0);
        return;
      }

      if (!isEditableTextField(target) && !isEditableSelect(target)) return;

      event.preventDefault();
      event.stopPropagation();
      if (target.value !== '') {
        setNativeValue(target, '');
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
      }
      dispatchEscapeClear(target);
      setTimeout(() => target.focus?.(), 0);
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  return null;
};

export default GlobalTextFieldShortcuts;
