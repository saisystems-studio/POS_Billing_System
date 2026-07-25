import React, { forwardRef } from 'react';

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const SharedSearchField = forwardRef(({
  value,
  placeholder,
  onChange,
  className = '',
  ...inputProps
}, ref) => (
  <div className={`shared-search-field${className ? ` ${className}` : ''}`}>
    <span className="shared-search-icon-wrapper" aria-hidden="true">
      <SearchIcon />
    </span>
    <input
      {...inputProps}
      ref={ref}
      type="search"
      value={value}
      placeholder={placeholder}
      onChange={onChange}
      aria-label={inputProps['aria-label'] || placeholder}
    />
  </div>
));

SharedSearchField.displayName = 'SharedSearchField';

export default SharedSearchField;
