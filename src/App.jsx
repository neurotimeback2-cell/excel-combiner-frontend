import { useState } from 'react';
import AllSheet from './AllSheet.jsx';
import CombineFiles from './CombineFiles.jsx';
import MergeReports from './MergeReports.jsx';

const MODES = [
  { id: 'combine', label: 'Combine files', Component: CombineFiles },
  { id: 'all-sheet', label: 'Add “All” sheet', Component: AllSheet },
  { id: 'reports', label: 'Merge weekly reports', Component: MergeReports },
];

// The tab is kept in the URL (#all-sheet), so a link can open it directly.
const modeFromHash = () => MODES.find((m) => `#${m.id}` === window.location.hash)?.id ?? MODES[0].id;

export default function App() {
  const [mode, setMode] = useState(modeFromHash);

  function select(id) {
    setMode(id);
    window.history.replaceState(null, '', `#${id}`);
  }

  return (
    <main>
      <header>
        <h1>Excel Combiner</h1>
        <nav className="tabs" role="tablist">
          {MODES.map((m) => (
            <button key={m.id} role="tab" aria-selected={mode === m.id} className="tab" onClick={() => select(m.id)}>
              {m.label}
            </button>
          ))}
        </nav>
      </header>

      {/* All modes stay mounted, so switching tabs keeps the chosen files and results. */}
      {MODES.map(({ id, Component }) => (
        <div key={id} className="mode" role="tabpanel" hidden={mode !== id}>
          <Component />
        </div>
      ))}
    </main>
  );
}
