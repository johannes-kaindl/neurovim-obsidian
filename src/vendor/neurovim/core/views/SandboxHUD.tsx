import React, { useState } from 'react';
import { SandboxState, SandboxBests, SandboxDifficulty } from '../types';
import { formatTime } from '../utils/time';

const SANDBOX_HINTS = [
  { key: 'CAPS WORD', description: 'gu + motion' },
  { key: 'JOIN LINE', description: 'J' },
  { key: 'CORP WORD', description: 'ciw + retype' },
];

interface SandboxHUDProps {
  sandboxState: SandboxState;
  elapsedMs: number;
  sandboxBests: SandboxBests;
  onSelectDifficulty: (d: SandboxDifficulty) => void;
  onSubmit: () => void;
  onAgain: () => void;
  onHarder: () => void;
}

function SandboxActiveHUD({ sandboxState, elapsedMs, onSubmit }: {
  sandboxState: SandboxState;
  elapsedMs: number;
  onSubmit: () => void;
}) {
  const [hintOpen, setHintOpen] = useState(false);
  const hint = sandboxState.cursor_hint;

  return (
    <div className="nv-float-hud nv-sandbox-hud" style={{ flexDirection: hintOpen ? 'column' : 'row' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {hint ? (
          <span className="nv-hud-hint">&gt;_ {hint}</span>
        ) : (
          <>
            <span className="nv-hud-mission">RAVEN // {sandboxState.remaining_glitches} ✗</span>
            <span className="nv-hud-timer">{formatTime(elapsedMs)}</span>
          </>
        )}
        <div className="nv-hud-actions">
          <button className="nv-btn nv-btn-submit" onClick={onSubmit}>SUBMIT</button>
          <button
            className="nv-btn-hint"
            onClick={() => setHintOpen(o => !o)}
            style={{ color: hintOpen ? 'var(--nv-green)' : 'var(--nv-green-muted)' }}
          >?</button>
        </div>
      </div>
      {hintOpen && (
        <div className="nv-hint-panel">
          <div className="nv-guide-header" style={{ marginBottom: '4px' }}>// GLITCH FIX</div>
          {SANDBOX_HINTS.map(k => (
            <div key={k.key} className="nv-hint-row">
              <span className="nv-hint-key" style={{ minWidth: '70px', color: 'var(--nv-amber)' }}>{k.key}</span>
              <span className="nv-hint-desc">{k.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SandboxHUD({
  sandboxState, elapsedMs, sandboxBests,
  onSelectDifficulty, onSubmit, onAgain, onHarder,
}: SandboxHUDProps) {
  if (sandboxState.status === null) {
    return (
      <div className="nv-float-hud nv-sandbox-hud">
        <span className="nv-hud-mission">&gt;_ RAVEN SANDBOX</span>
        <div className="nv-sandbox-difficulty">
          {(['easy', 'normal', 'hard'] as SandboxDifficulty[]).map(d => (
            <button
              key={d}
              className={`nv-btn nv-btn-difficulty${sandboxState.difficulty === d ? ' nv-btn-difficulty-active' : ''}`}
              onClick={() => onSelectDifficulty(d)}
            >
              <span>{d.toUpperCase()} {d === 'easy' ? '3' : d === 'normal' ? '7' : '15'}</span>
              {sandboxBests[d] !== null && (
                <span className="nv-difficulty-pb">PB {formatTime(sandboxBests[d])}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (sandboxState.status === 'active') {
    return <SandboxActiveHUD sandboxState={sandboxState} elapsedMs={elapsedMs} onSubmit={onSubmit} />;
  }

  if (sandboxState.status === 'result') {
    const resultMsg = sandboxState.cursor_hint;
    return (
      <div className="nv-float-hud nv-sandbox-hud">
        <span className="nv-hud-mission">{resultMsg ?? formatTime(elapsedMs)}</span>
        <div className="nv-hud-actions">
          <button className="nv-btn nv-btn-drill" onClick={onAgain}>NOCHMAL</button>
          <button className="nv-btn nv-btn-submit" onClick={onHarder}>HARDER</button>
        </div>
      </div>
    );
  }

  return null;
}
