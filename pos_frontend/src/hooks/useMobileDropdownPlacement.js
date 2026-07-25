import { useEffect, useState } from 'react';

const MOBILE_QUERY = '(max-width: 768px)';
const MAX_MENU_HEIGHT = 240;
const MIN_USEFUL_SPACE = 180;
const FORM_ACTION_RESERVE = 110;
const EDGE_GAP = 12;

/**
 * Keeps an absolutely-positioned dropdown inside the mobile viewport.
 * Desktop callers retain their existing placement and dimensions.
 */
export default function useMobileDropdownPlacement(anchorRef, open) {
  const [placement, setPlacement] = useState({ openUp: false, maxHeight: MAX_MENU_HEIGHT });

  useEffect(() => {
    if (!open || !anchorRef.current || !window.matchMedia(MOBILE_QUERY).matches) {
      setPlacement({ openUp: false, maxHeight: MAX_MENU_HEIGHT });
      return undefined;
    }

    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;

      const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - FORM_ACTION_RESERVE);
      const spaceAbove = Math.max(0, rect.top - EDGE_GAP);
      const openUp = spaceBelow < MIN_USEFUL_SPACE && spaceAbove > spaceBelow;
      const available = openUp ? spaceAbove : spaceBelow;

      setPlacement({
        openUp,
        maxHeight: Math.max(120, Math.min(MAX_MENU_HEIGHT, available)),
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.addEventListener('scroll', update, true);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.removeEventListener('scroll', update, true);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [anchorRef, open]);

  return {
    menuClassName: `shared-dropdown-menu ${placement.openUp ? 'open-up' : 'open-down'}`,
    mobileMenuStyle: { '--mobile-dropdown-max-height': `${placement.maxHeight}px` },
  };
}
