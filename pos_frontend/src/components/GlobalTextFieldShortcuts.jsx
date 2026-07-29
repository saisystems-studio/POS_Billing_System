import { useEffect } from 'react';

const fieldSelector = [
  'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"])',
  'select',
  'textarea',
  '[data-escape-clear="true"]',
  '[data-keyboard-field="true"]',
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
  .filter(field => field.type !== 'radio' || field.checked)
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

const validateBeforeForward = target => {
  target.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  const invalidByReact = target.getAttribute('aria-invalid') === 'true'
    || target.classList.contains('is-invalid');
  const invalidByBrowser = typeof target.checkValidity === 'function' && !target.checkValidity();
  if (!invalidByReact && !invalidByBrowser) return true;
  target.focus({ preventScroll: false });
  target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  if (invalidByBrowser) target.reportValidity?.();
  return false;
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
  if (target.matches('[data-escape-clear="true"], [data-sales-dropdown="true"]')
    || target.dataset.salesRate === 'true') {
    target.dispatchEvent(new CustomEvent('pos-escape-clear-field', {
      bubbles: true,
      detail: { source: target },
    }));
  }
  if (target instanceof HTMLInputElement && ['checkbox', 'radio'].includes(target.type)) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
    descriptor?.set?.call(target, false);
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    requestAnimationFrame(() => target.focus?.());
    return;
  }
  if ('value' in target && target.value !== '') {
    setNativeValue(target, '');
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  }
  requestAnimationFrame(() => target.focus?.());
};

// Remove exactly one character. React-controlled inputs receive the native
// event so their existing onChange handlers remain the source of truth.
const deleteOneCharacter = target => {
  if (!('value' in target) || !target.value) return false;
  const start = typeof target.selectionStart === 'number' ? target.selectionStart : target.value.length;
  const end = typeof target.selectionEnd === 'number' ? target.selectionEnd : start;
  const from = start === end ? Math.max(0, start - 1) : start;
  const value = `${target.value.slice(0, from)}${target.value.slice(end)}`;
  setNativeValue(target, value);
  target.dispatchEvent(new Event('input', { bubbles: true }));
  target.dispatchEvent(new Event('change', { bubbles: true }));
  requestAnimationFrame(() => target.setSelectionRange?.(from, from));
  return true;
};

const GlobalTextFieldShortcuts = () => {
  useEffect(() => {
    const submitting = new WeakSet();
    const checkboxState = new WeakMap();
    const highlighted = new WeakMap();
    const dropdownFor = target => {
      const root = target.closest('[data-sales-dropdown="true"], .app-dropdown, [role="combobox"]');
      if (!root) return null;
      const menu = root.parentElement?.querySelector('ul[data-sales-dropdown-open="true"], ul');
      if (!menu || window.getComputedStyle(menu).display === 'none') return null;
      const options = [...menu.querySelectorAll(':scope > li')].filter(li =>
        li.getClientRects().length && li.getAttribute('aria-disabled') !== 'true' && !li.disabled
      );
      return options.length ? { menu, options } : null;
    };
    const handleDropdownKey = (event, target) => {
      const dropdown = dropdownFor(target);
      if (!dropdown || !['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return false;
      const { menu, options } = dropdown;
      let index = highlighted.get(target);
      if (!Number.isInteger(index)) index = -1;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); event.stopPropagation();
        index = event.key === 'ArrowDown'
          ? Math.min(index + 1, options.length - 1)
          : Math.max(index - 1, 0);
        highlighted.set(target, index);
        options.forEach((option, i) => {
          option.classList.toggle('pos-dropdown-highlighted', i === index);
          option.classList.remove('pos-dropdown-hover');
        });
        options[index]?.scrollIntoView?.({ block: 'nearest' });
        return true;
      }
      event.preventDefault(); event.stopPropagation();
      if (index >= 0) {
        options[index].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        highlighted.delete(target);
        requestAnimationFrame(() => move(target, 1));
      } else {
        target.dispatchEvent(new CustomEvent('pos-dropdown-enter-empty', { bubbles: true }));
        requestAnimationFrame(() => move(target, 1));
      }
      return true;
    };
    const handleCheckboxEnter = (event, target) => {
      if (event.key !== 'Enter' || !(target instanceof HTMLInputElement) || target.type !== 'checkbox') return false;
      event.preventDefault();
      event.stopPropagation();
      let state = checkboxState.get(target);
      if (!state) state = { count: 0, timer: null };
      state.count += 1;
      if (state.timer) clearTimeout(state.timer);
      state.timer = setTimeout(() => {
        const doublePress = state.count >= 2;
        state.count = 0;
        state.timer = null;
        if (doublePress) {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
          setter?.call(target, !target.checked);
          target.dispatchEvent(new Event('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
          requestAnimationFrame(() => move(target, 1));
          return;
        }
        move(target, 1);
      }, 300);
      checkboxState.set(target, state);
      return true;
    };
    const mouseHandler = event => {
      const option = event.target?.closest?.('ul > li');
      if (!option || !option.closest('[data-sales-dropdown-open="true"], .app-dropdown')) return;
      if (option.getAttribute('aria-disabled') === 'true' || option.disabled) return;
      const owner = option.closest('.app-dropdown, [role="combobox"]')?.querySelector('input')
        || document.activeElement;
      const siblings = [...option.parentElement.querySelectorAll(':scope > li')];
      highlighted.set(owner, siblings.indexOf(option));
      siblings.forEach(item => {
        item.classList.toggle('pos-dropdown-hover', item === option);
        if (item !== option) item.classList.remove('pos-dropdown-highlighted');
      });
    };
    const handler = event => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      if (handleCheckboxEnter(event, target)) return;
      if (handleDropdownKey(event, target)) return;

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
      const searchableManaged = target.matches('[role="combobox"], [data-escape-clear="true"], [data-sales-dropdown="true"]')
        || Boolean(target.closest('[role="combobox"]'));

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        clearField(target);
        return;
      }

      if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (billingManaged || searchableManaged || dropdownOpen
          || target.matches('input[type="radio"]')) return;
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat && validateBeforeForward(target)) move(target, 1);
        return;
      }

      if (event.key === 'Backspace' && !event.altKey && !event.ctrlKey && !event.metaKey) {
        const openSearchableDropdown = target.getAttribute('aria-expanded') === 'true'
          || Boolean(target.closest('[role="combobox"][aria-expanded="true"]'))
          || Boolean(document.querySelector('[role="listbox"]'));
        if (billingManaged || dropdownOpen || openSearchableDropdown) return;
        event.preventDefault();
        event.stopPropagation();
        if ('value' in target && target.value !== '') {
          deleteOneCharacter(target);
        } else {
          move(target, -1);
        }
      }
    };

    window.addEventListener('keydown', handler, true);
    window.addEventListener('mouseover', mouseHandler, true);
    return () => {
      window.removeEventListener('keydown', handler, true);
      window.removeEventListener('mouseover', mouseHandler, true);
    };
  }, []);
  return null;
};

export default GlobalTextFieldShortcuts;
