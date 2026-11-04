import { useState } from 'react';
import Dropzone from './Dropzone.jsx';
import { fmt, formatSize, postFiles } from './shared.js';

const REPORT_EXTENSIONS = ['.xlsx', '.xlsm'];
const isReport = (file) => REPORT_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
const fileId = (f) => `${f.name}|${f.size}|${f.lastModified}`;
// "AZAL_5 October" before "AZAL_12 October".
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

export default function MergeReports() {
  const [files, setFiles] = useState([]);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  function resetResult() {
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
    setError('');
  }

  function addFiles(list) {
    const incoming = [...list];
    const valid = incoming.filter(isReport);
    const known = new Set(files.map(fileId));
    const fresh = valid.filter((f) => !known.has(fileId(f)) && known.add(fileId(f)));

    const skipped = [];
    if (incoming.length > valid.length) skipped.push(`${incoming.length - valid.length} file(s) ignored — only .xlsx files can be merged here`);
    if (valid.length > fresh.length) skipped.push(`${valid.length - fresh.length} duplicate(s) ignored`);
    setNotice(skipped.join(', '));

    if (fresh.length) {
      // Files added later go after the ones already in the list, so a chosen order is kept.
      setFiles([...files, ...fresh.sort(byName)]);
      resetResult();
    }
  }

  function move(index, by) {
    const next = [...files];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    setFiles(next);
    resetResult();
  }

  function removeFile(id) {
    setFiles(files.filter((f) => fileId(f) !== id));
    resetResult();
  }

  function clearAll() {
    setFiles([]);
    setNotice('');
    resetResult();
  }

  async function merge() {
    resetResult();
    setWorking(true);
    try {
      const body = new FormData();
      files.forEach((f) => body.append('files', f, f.name));
      const { report, url } = await postFiles('/merge-reports', body);
      const base = files[0].name;
      const ext = base.match(/\.[^.]+$/)?.[0] ?? '.xlsx';
      setResult({ report, url, fileName: `${base.slice(0, -ext.length).trim()} (merged)${ext}` });
    } catch (err) {
      setError(err.message || 'Could not reach the server.');
    } finally {
      setWorking(false);
    }
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <>
      <p className="muted intro">
        For reports with the same layout every week — a Dashboard with formulas, All_Platforms, and a sheet per
        platform. The first file is the base: its Dashboard, design, charts and column order stay exactly as they
        are, and the rows of the other files are added at the bottom of each matching sheet, with their own
        formatting and links. Excel recalculates the Dashboard when the merged file is opened.
      </p>

      <Dropzone title="Drop weekly report files here" accept={REPORT_EXTENSIONS.join(',')} hint=".xlsx" multiple onFiles={addFiles} />
      {notice && <p className="notice">{notice}</p>}

      {files.length > 0 && (
        <section className="card">
          <div className="row">
            <h2>{files.length} file{files.length > 1 ? 's' : ''} <span className="muted">· {formatSize(totalSize)}</span></h2>
            <button className="link" onClick={clearAll} disabled={working}>Clear all</button>
          </div>
          <ol className="files">
            {files.map((f, i) => (
              <li key={fileId(f)}>
                <div>
                  <span className="name" title={f.name}>{f.name}</span>
                  {i === 0 && <span className="badge">base</span>}
                  <span className="muted">{formatSize(f.size)}</span>
                  <span className="order">
                    <button onClick={() => move(i, -1)} disabled={working || i === 0} aria-label={`Move ${f.name} up`}>↑</button>
                    <button onClick={() => move(i, 1)} disabled={working || i === files.length - 1} aria-label={`Move ${f.name} down`}>↓</button>
                  </span>
                  <button className="remove" onClick={() => removeFile(fileId(f))} disabled={working} aria-label={`Remove ${f.name}`}>×</button>
                </div>
              </li>
            ))}
          </ol>
          <div className="row actions">
            <span className="muted">
              {files.length < 2
                ? 'Add at least one more file.'
                : 'Rows are added in this order. Use ↑ ↓ to change it — the first file is the base.'}
            </span>
            <button className="primary" onClick={merge} disabled={working || files.length < 2}>
              {working ? 'Merging…' : 'Merge reports'}
            </button>
          </div>
        </section>
      )}

      {error && <div className="error"><strong>Nothing was merged.</strong> {error}</div>}
      {result && <Result {...result} />}
    </>
  );
}

function Result({ report, url, fileName }) {
  const { files, sheets, totalRows, addedRows } = report;
  const merged = sheets.filter((s) => !s.kept);
  const kept = sheets.filter((s) => s.kept);

  const notes = [];
  if (kept.length) {
    notes.push(`${kept.map((s) => `“${s.name}”`).join(', ')}: kept from the first file, only its formulas are recalculated. Text typed in by hand there, such as the dates in the title, stays as in the first file.`);
  }
  for (const s of merged) {
    const missingIn = files.filter((_, i) => s.perFile[i] === null);
    if (missingIn.length) notes.push(`Sheet “${s.name}” is not in: ${missingIn.join(', ')}.`);
    for (const n of s.notes) notes.push(`${s.name} — ${n}`);
  }
  notes.push(...report.notes);
  notes.push('File previews (e.g. in e-mail) may still show the first file’s Dashboard numbers; Excel shows the new ones when it opens the file.');

  return (
    <section className="card">
      <div className="success">
        <div>
          <strong>✓ Verified: all {fmt(totalRows)} rows are in the merged file ({fmt(addedRows)} added to the first file).</strong>
          <div className="muted">The output was read back and checked cell by cell against every upload.</div>
        </div>
        <a className="button primary" href={url} download={fileName}>Download {fileName}</a>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sheet</th>
              {files.map((name, i) => <th key={i} className="num" title={name}>{i === 0 ? 'Base' : `File ${i + 1}`}</th>)}
              <th className="num">Rows</th>
            </tr>
          </thead>
          <tbody>
            {sheets.map((s) => (
              <tr key={s.name}>
                <td className="name" title={s.name}>{s.name}</td>
                {s.kept ? (
                  <td colSpan={files.length + 1} className="muted">kept from the first file (formulas)</td>
                ) : (
                  <>
                    {s.perFile.map((n, i) => <td key={i} className="num">{n === null ? <span className="muted">—</span> : fmt(n)}</td>)}
                    <td className="num"><strong>{fmt(s.totalRows)}</strong></td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="legend muted">
        {files.map((name, i) => <li key={i} title={name}>{i === 0 ? 'Base' : `File ${i + 1}`}: {name}</li>)}
      </ul>

      <div className="notes">
        <h3>Notes</h3>
        <ul>{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
      </div>
    </section>
  );
}
