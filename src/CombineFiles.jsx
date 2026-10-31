import { useState } from 'react';
import Dropzone from './Dropzone.jsx';
import { fmt, formatSize, isExcel, postFiles, truncatedNotes } from './shared.js';

const fileId = (f) => `${f.name}|${f.size}|${f.lastModified}`;
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

export default function CombineFiles() {
  const [files, setFiles] = useState([]);
  const [addCompanyColumn, setAddCompanyColumn] = useState(true);
  const [addSourceColumn, setAddSourceColumn] = useState(false);
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
    const valid = incoming.filter(isExcel);
    const known = new Set(files.map(fileId));
    const fresh = valid.filter((f) => !known.has(fileId(f)) && known.add(fileId(f)));

    const skipped = [];
    if (incoming.length > valid.length) skipped.push(`${incoming.length - valid.length} non-Excel file(s) ignored`);
    if (valid.length > fresh.length) skipped.push(`${valid.length - fresh.length} duplicate(s) ignored`);
    setNotice(skipped.join(', '));

    if (fresh.length) {
      setFiles([...files, ...fresh].sort(byName));
      resetResult();
    }
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

  async function combine() {
    resetResult();
    setWorking(true);
    try {
      const body = new FormData();
      files.forEach((f) => body.append('files', f, f.name));
      body.append('addCompanyColumn', String(addCompanyColumn));
      body.append('addSourceColumn', String(addSourceColumn));

      const { report, url } = await postFiles('/combine', body);
      const fileName = `combined-${new Date().toISOString().slice(0, 10)}.xlsx`;
      setResult({ report, url, fileName });
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
        Upload Excel files that share the same sheets. Rows from every file are merged sheet by sheet — all
        “Instagram” rows into one “Instagram” sheet, and so on. Columns are matched by header name.
        Name each file after its company (e.g. “Pasha Bank.xlsx”) to see which company every row came from.
      </p>

      <Dropzone title="Drop Excel files here" multiple onFiles={addFiles} />
      {notice && <p className="notice">{notice}</p>}

      {files.length > 0 && (
        <section className="card">
          <div className="row">
            <h2>{files.length} file{files.length > 1 ? 's' : ''} <span className="muted">· {formatSize(totalSize)}</span></h2>
            <button className="link" onClick={clearAll} disabled={working}>Clear all</button>
          </div>
          <ol className="files">
            {files.map((f) => (
              <li key={fileId(f)}>
                <div>
                  <span className="name" title={f.name}>{f.name}</span>
                  <span className="muted">{formatSize(f.size)}</span>
                  <button className="remove" onClick={() => removeFile(fileId(f))} disabled={working} aria-label={`Remove ${f.name}`}>×</button>
                </div>
              </li>
            ))}
          </ol>
          <div className="row actions">
            <div className="options">
              <label>
                <input
                  type="checkbox"
                  checked={addCompanyColumn}
                  onChange={(e) => { setAddCompanyColumn(e.target.checked); resetResult(); }}
                  disabled={working}
                />
                Add a “Company” column <span className="muted">(file name without extension)</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={addSourceColumn}
                  onChange={(e) => { setAddSourceColumn(e.target.checked); resetResult(); }}
                  disabled={working}
                />
                Add a “Source file” column
              </label>
            </div>
            <button className="primary" onClick={combine} disabled={working}>
              {working ? 'Combining…' : 'Combine files'}
            </button>
          </div>
        </section>
      )}

      {error && <div className="error"><strong>Nothing was combined.</strong> {error}</div>}
      {result && <Result {...result} />}
    </>
  );
}

function Result({ report, url, fileName }) {
  const { files, sheets, totalRows } = report;
  const notes = [];
  for (const s of sheets) {
    const missingIn = files.filter((_, i) => s.perFile[i] === null);
    if (missingIn.length) notes.push(`Sheet “${s.name}” is not in: ${missingIn.join(', ')}.`);
    for (const m of s.missingColumns) {
      notes.push(`Sheet “${s.name}” in ${m.file} has no ${m.columns.map((c) => `“${c}”`).join(', ')} column — those cells are left empty.`);
    }
    if (s.blankRowsSkipped) notes.push(`Sheet “${s.name}”: ${fmt(s.blankRowsSkipped)} completely empty row(s) skipped.`);
  }
  notes.push(...truncatedNotes(report));

  return (
    <section className="card">
      <div className="success">
        <div>
          <strong>✓ Verified: all {fmt(totalRows)} rows from {files.length} file{files.length > 1 ? 's' : ''} are in the combined file.</strong>
          <div className="muted">The output was read back and checked cell by cell against the uploads.</div>
        </div>
        <a className="button primary" href={url} download={fileName}>Download {fileName}</a>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>File</th>
              {sheets.map((s) => <th key={s.name} className="num">{s.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {files.map((name, i) => (
              <tr key={i}>
                <td className="name" title={name}>{name}</td>
                {sheets.map((s) => (
                  <td key={s.name} className="num">{s.perFile[i] === null ? <span className="muted">—</span> : fmt(s.perFile[i])}</td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total rows</td>
              {sheets.map((s) => <td key={s.name} className="num">{fmt(s.totalRows)}</td>)}
            </tr>
            <tr className="muted">
              <td>Columns</td>
              {sheets.map((s) => <td key={s.name} className="num">{s.columns}</td>)}
            </tr>
          </tfoot>
        </table>
      </div>

      {notes.length > 0 && (
        <div className="notes">
          <h3>Notes</h3>
          <ul>{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      )}
    </section>
  );
}
