import { useRef, useState } from 'react';
import { ACCEPT } from './shared.js';

export default function Dropzone({ title, multiple = false, accept = ACCEPT, hint = '.xlsx, .xls, .xlsm, .xlsb, .ods', onFiles }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  return (
    <div
      className={`dropzone ${dragging ? 'dragging' : ''}`}
      onClick={() => inputRef.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }}
      />
      <strong>{title}</strong>
      <span className="muted">or click to choose · {hint}</span>
    </div>
  );
}
