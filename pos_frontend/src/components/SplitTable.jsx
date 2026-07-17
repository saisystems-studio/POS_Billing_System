import React from 'react';

const SplitTable = ({
  className = 'table table-compact',
  head,
  children,
  splitAt = 30,
  tableProps = {},
  tableRef = null,
  empty = false,
  disableSplit = false,
  colgroup = null,
  footer = null,
}) => {
  const getText = node => {
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(getText).filter(Boolean).join(' ');
    if (React.isValidElement(node)) return getText(node.props.children);
    return '';
  };

  const enhanceRows = rows => React.Children.map(rows, row => {
    if (!React.isValidElement(row)) return row;
    const cells = React.Children.map(row.props.children, cell => {
      if (!React.isValidElement(cell) || cell.type !== 'td') return cell;
      const text = getText(cell.props.children).replace(/\s+/g, ' ').trim();
      return React.cloneElement(cell, {
        title: cell.props.title ?? (text || undefined),
      });
    });
    return React.cloneElement(row, undefined, cells);
  });

  const rows = enhanceRows(children);

  return (
    <div
      className={`table-wrapper table-wrapper-scroll split-table-wrapper${empty ? ' is-empty' : ''}${disableSplit ? ' split-disabled' : ''}`}
      data-split-at={splitAt}
    >
      <div className="split-table-panel split-table-panel-left">
        <table {...tableProps} ref={tableRef} className={className}>
          {colgroup}
          <thead>{head}</thead>
          <tbody>{rows}</tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>
    </div>
  );
};

export default SplitTable;
