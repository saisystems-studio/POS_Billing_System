import React from 'react';

const ArrowLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </svg>
);

const Menu = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const MobilePageHeader = ({ onBack, onMenuOpen, hideBack = false, menuOpen = false }) => (
  <div className="mobile-page-header">
    <div className="mobile-header-left">
      {!hideBack && <button type="button" className="mobile-back-button" onClick={onBack} aria-label="Go back"><ArrowLeft /></button>}
    </div>
    <button type="button" className="mobile-menu-button" onClick={onMenuOpen} aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} aria-controls="app-sidebar"><Menu /></button>
  </div>
);

export default MobilePageHeader;
