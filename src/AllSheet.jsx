import { useState } from 'react';
import Dropzone from './Dropzone.jsx';
import { fmt, formatSize, isExcel, postFiles } from './shared.js';

export default function AllSheet() {
  const [file, setFile] = useState(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  function resetResult() {
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
    setError('');
  }

  function chooseFile(list) {
    const excel = [...list].filter(isExcel);
    if (!excel.length) {
      setNotice('That is not an Excel file.');
      return;
    }
    setNotice(list.length > 1 ? `One file at a time: using “${excel[0].name}”.` : '');
    setFile(excel[0]);
    resetResult();
  }

  function removeFile() {
    setFile(null);
    setNotice('');
    resetResult();
  }

  async function run() {
    resetResult();
    setWorking(true);
    try {
      const body = new FormData();
      body.append('file', file, file.name);
      const { report, url } = await postFiles('/all-sheet', body);
      const fileName = `${file.name.replace(/\.[^.]+$/, '')} - All.xlsx`;
      setResult({ report, url, fileName });
    } catch (err) {
      setError(err.message || 'Could not reach the server.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <p className="muted intro">
        Upload one Excel file with a sheet per platform — posts (Facebook, Instagram, TikTok, …) and comments
        (“Facebook comments”, …). All their rows are merged into a new “All” sheet, added first in the same file,
        with Platform and Type (Post / Comment) columns. Columns are matched by name; YouTube’s Title is left out.
        The original sheets stay as they are.
      </p>

      <Dropzone title="Drop an Excel file here" onFiles={chooseFile} />
      {notice && <p className="notice">{notice}</p>}

      {file && (
        <section className="card">
          <div className="files single">
            <div>
              <span className="name" title={file.name}>{file.name}</span>
              <span className="muted">{formatSize(file.size)}</span>
              <button className="remove" onClick={removeFile} disabled={working} aria-label={`Remove ${file.name}`}>×</button>
            </div>
          </div>
          <div className="row actions end">
            <button className="primary" onClick={run} disabled={working}>
              {working ? 'Merging…' : 'Add “All” sheet'}
            </button>
          </div>
        </section>
      )}

      {error && <div className="error"><strong>Nothing was changed.</strong> {error}</div>}
      {result && <Result {...result} />}
    </>
  );
}

const list = (items) => items.map((s) => `“${s}”`).join(', ');

function Result({ report, url, fileName }) {
  const { sheets, totalRows, columns } = report;

  // Group "column left out" and "extra column" by column, listing the sheets.
  const bySheet = (key) => {
    const groups = new Map();
    for (const s of sheets) for (const col of s[key]) groups.set(col, [...(groups.get(col) ?? []), s.name]);
    return [...groups];
  };
  const notes = [];
  for (const [col, names] of bySheet('leftOut')) {
    const why = col.toLowerCase() === 'source' ? ' because it only repeats the platform' : '';
    notes.push(`“${col}” is left out of “All”${why} (${names.join(', ')}). It stays in the original sheet${names.length > 1 ? 's' : ''}.`);
  }
  for (const [col, names] of bySheet('extraColumns')) {
    notes.push(`“${col}” (only in ${list(names)}) is added at the end of “All”.`);
  }
  for (const c of report.changes) notes.push(`${c.column}: ${fmt(c.count)} value${c.count > 1 ? 's' : ''} ${c.note}.`);
  if (report.daysFilled) notes.push(`Day: filled in from Date for ${fmt(report.daysFilled)} row${report.daysFilled > 1 ? 's' : ''} that had no Day.`);
  if (report.unreadDates) notes.push(`${fmt(report.unreadDates)} date${report.unreadDates > 1 ? 's' : ''} could not be read and ${report.unreadDates > 1 ? 'were' : 'was'} kept as text.`);
  if (report.replacedExisting) notes.push('The file already had an “All” sheet; it was rebuilt from the other sheets.');

  const posts = sheets.filter((s) => s.type === 'Post').reduce((sum, s) => sum + s.rows, 0);

  return (
    <section className="card">
      <div className="success">
        <div>
          <strong>✓ Verified: all {fmt(totalRows)} rows from {sheets.length} sheet{sheets.length > 1 ? 's' : ''} are in “All”.</strong>
          <div className="muted">
            {fmt(posts)} posts and {fmt(totalRows - posts)} comments. The output was read back and checked value by value;
            the original sheets are unchanged.
          </div>
        </div>
        <a className="button primary" href={url} download={fileName}>Download {fileName}</a>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sheet</th>
              <th>Platform</th>
              <th>Type</th>
              <th className="num">Rows</th>
            </tr>
          </thead>
          <tbody>
            {sheets.map((s) => (
              <tr key={s.name}>
                <td className="name" title={s.name}>{s.name}</td>
                <td>{s.platform}</td>
                <td>{s.type}</td>
                <td className="num">{fmt(s.rows)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Total in “All”</td>
              <td className="num">{fmt(totalRows)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="notes">
        <h3>Columns in “All”</h3>
        <p className="columns">{columns.join(' · ')}</p>
        {notes.length > 0 && (
          <>
            <h3>Notes</h3>
            <ul>{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
          </>
        )}
      </div>
    </section>
  );
}
