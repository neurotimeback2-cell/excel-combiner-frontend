export const ACCEPT = '.xlsx,.xlsm,.xlsb,.xls,.ods';
// Set VITE_API_URL to an absolute API address when it is hosted separately.
// The default keeps the existing nginx/Vite-proxy deployment working.
const API_URL = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '');

export const isExcel = (file) => ACCEPT.split(',').some((ext) => file.name.toLowerCase().endsWith(ext));
export const fmt = (n) => n.toLocaleString('en-US');

/** Notes for texts the server cut to Excel's limit of 32,767 characters per cell. */
export function truncatedNotes(report) {
  return (report.truncatedTexts ?? []).map(({ sheet, cells }) => {
    const many = cells.length > 1;
    const list = cells.slice(0, 10).join(', ') + (cells.length > 10 ? ', …' : '');
    return `Sheet “${sheet}”: ${fmt(cells.length)} cell${many ? 's' : ''} had more than 32,767 characters (Excel’s limit per cell) and ${many ? 'were' : 'was'} cut to fit: ${list}.`;
  });
}

export function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Errors produced by nginx rather than the backend come without a JSON body.
function httpError(status) {
  if (status === 413) return 'The upload is too large for the server. Try fewer or smaller files.';
  if (status === 502 || status === 503) return 'The combine service is not running. Ask the admin to check the backend.';
  if (status === 504) return 'The server took too long to respond. Try fewer files at a time.';
  return `Server error (${status}).`;
}

/** POST a form to the API. Resolves to the report and a download URL for the returned workbook. */
export async function postFiles(path, body) {
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', body }).catch(() => {
    throw new Error('Could not reach the server.');
  });
  const data = await res.json().catch(() => ({ error: httpError(res.status) }));
  if (!res.ok) throw new Error(data.error);

  const blob = await (await fetch(`data:application/octet-stream;base64,${data.file}`)).blob();
  return { report: data.report, url: URL.createObjectURL(blob) };
}
