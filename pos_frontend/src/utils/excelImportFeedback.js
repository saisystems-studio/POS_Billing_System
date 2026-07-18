const pickNumber = (...values) => {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
};

const pickRows = (...values) => {
  for (const value of values) {
    if (!Array.isArray(value)) continue;
    return value
      .map(row => Number(typeof row === 'object' ? row.row : row))
      .filter(Number.isFinite);
  }
  return [];
};

const compactRows = (rows, limit = 12) => {
  const visible = rows.slice(0, limit);
  const text = visible.join(', ');
  return rows.length > limit ? `${text}, +${rows.length - limit} more` : text;
};

export const normalizeImportMessages = (value) => {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  if (typeof value === 'string') return [{ reason: value }];
  if (typeof value !== 'object') return [{ reason: String(value) }];

  if (value.detail || value.message || value.error || value.reason) {
    return [{ reason: value.detail || value.message || value.error || value.reason }];
  }

  return Object.entries(value).flatMap(([field, messages]) => {
    if (Array.isArray(messages)) {
      return messages.map(message => ({ field, reason: String(message) }));
    }
    if (messages == null || messages === '') return [];
    if (typeof messages === 'object') {
      return normalizeImportMessages(messages).map(row => ({
        ...row,
        field: row.field ? `${field}.${row.field}` : field,
      }));
    }
    return [{ field, reason: String(messages) }];
  });
};

export const getImportCounts = (result = {}) => {
  const summary = result.summary || {};
  const rejectedRows = normalizeImportMessages(result.rejected_rows);
  return {
    totalRows: pickNumber(result.total_rows, summary.total_rows),
    imported: pickNumber(result.imported_count, summary.imported_count, result.imported_rows, summary.imported_rows, result.products_created, summary.products_created),
    newProducts: pickNumber(result.products_created, summary.products_created, result.imported, summary.imported),
    duplicates: pickNumber(result.duplicate_count, summary.duplicate_count, result.duplicate_rows, summary.duplicate_rows, result.skipped_duplicates, result.products_skipped_as_duplicates, summary.products_skipped_as_duplicates),
    existingDuplicates: pickNumber(result.database_duplicate_count, summary.database_duplicate_count, result.duplicate_existing_database, summary.duplicate_existing_database, result.existing_duplicates, summary.existing_duplicates),
    duplicatesInsideFile: pickNumber(result.file_duplicate_count, summary.file_duplicate_count, result.duplicate_inside_file, summary.duplicate_inside_file, result.duplicates_inside_file, summary.duplicates_inside_file),
    reactivated: pickNumber(result.reactivated_products, summary.reactivated_products, result.products_restored, summary.products_restored),
    rejected: pickNumber(result.rejected_count, summary.rejected_count, result.invalid_rows_rejected, summary.invalid_rows_rejected, rejectedRows.length),
  };
};

export const formatImportDetails = (result = {}) => {
  const rows = [
    ...normalizeImportMessages(result.skipped_rows),
    ...normalizeImportMessages(result.rejected_rows ?? result.errors),
  ];
  return rows.slice(0, 6).map(row => {
    const context = [row.group, row.product].filter(Boolean).join(' / ');
    const field = row.field ? `${row.field}: ` : '';
    const prefix = row.row ? `Row ${row.row}${context ? ` - ${context}` : ''} - ` : '';
    return `${prefix}${field}${row.reason || row.error || row.detail || row.message || 'Rejected'}`;
  }).join('\n');
};

export const getImportToast = (result = {}, fallbackFileName = '') => {
  const counts = getImportCounts(result);
  const fileName = result.file_name || fallbackFileName || '';
  let title = 'Excel Import Completed';
  let type = 'success';

  if (counts.imported > 0 && counts.rejected > 0) {
    title = 'Excel Import Completed with Warnings';
    type = 'warning';
  } else if (counts.imported === 0 && counts.duplicates > 0) {
    title = 'No New Products Imported';
    type = 'warning';
  } else if (counts.imported === 0 && counts.rejected > 0) {
    title = 'Excel Import Rejected';
    type = 'error';
  }

  const lines = [];
  if (fileName) lines.push(`File: ${fileName}`);
  if (counts.totalRows) lines.push(`Total Rows: ${counts.totalRows}`);
  lines.push(`Successfully Imported: ${counts.imported}`);
  lines.push(`Database Duplicates: ${counts.existingDuplicates}`);
  lines.push(`Repeated Products in Excel: ${counts.duplicatesInsideFile}`);
  if (counts.reactivated) lines.push(`Reactivated Products: ${counts.reactivated}`);
  lines.push(`Rejected Rows: ${counts.rejected}`);

  const repeatedRows = pickRows(result.repeated_product_row_numbers, result.file_duplicate_row_numbers);
  const databaseRows = pickRows(result.database_duplicate_row_numbers);
  const rejectedRows = pickRows(result.rejected_row_numbers, result.rejected_rows, result.errors);
  const detailLines = [];
  if (repeatedRows.length) {
    lines.push(`Repeated Product Row Numbers:`);
    lines.push(compactRows(repeatedRows));
    if (repeatedRows.length > 12) detailLines.push(`Repeated Product Row Numbers:\n${repeatedRows.join(', ')}`);
  }
  if (databaseRows.length > 12) detailLines.push(`Database Duplicate Row Numbers:\n${databaseRows.join(', ')}`);
  if (rejectedRows.length > 12) detailLines.push(`Rejected Row Numbers:\n${rejectedRows.join(', ')}`);

  return {
    type,
    title,
    message: lines.join('\n'),
    duration: 16000,
    counts,
    detailsLabel: detailLines.length ? 'View Details' : '',
    details: detailLines.join('\n\n'),
  };
};

export const isCanceledImport = (err) =>
  err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError' || String(err?.message || '').toLowerCase() === 'canceled';

export const isTimeoutImport = (err) =>
  err?.code === 'ECONNABORTED' || /timeout|timed out/i.test(String(err?.message || ''));

export const formatBackendImportError = (err, fallback = 'The file could not be processed.') => {
  const data = err?.response?.data;
  if (!data) {
    if (err?.request) return 'Network failure. The server did not respond.';
    return err?.message || fallback;
  }
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  if (data.message && data.message !== 'Excel Import Rejected') return data.message;
  if (data.error) return data.error;
  const fieldErrors = Object.entries(data)
    .filter(([, value]) => Array.isArray(value) || typeof value === 'string')
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`);
  return fieldErrors.join(' | ') || fallback;
};
