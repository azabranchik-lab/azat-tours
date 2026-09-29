// CSV for Excel (SPEC §6.10): UTF-8 with BOM and ';' as the separator, which is
// what Excel expects in Russian locales, so a double-click opens it in columns.
const SEP = ';';

function cell(v) {
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// columns: [[header, row => value], ...]
function toCsv(rows, columns) {
  const lines = [columns.map(([h]) => cell(h)).join(SEP)];
  for (const r of rows) lines.push(columns.map(([, get]) => cell(get(r))).join(SEP));
  return Buffer.from('﻿' + lines.join('\r\n') + '\r\n', 'utf8');
}

module.exports = { toCsv };
