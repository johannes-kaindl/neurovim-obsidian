import React, { useState } from 'react';
import { HudMode, MissionState } from '../types';
import { formatTime } from '../utils/time';
import { getHintKeys } from '../utils/hints';
import { CHEATSHEET } from '../data/cheatsheet';

interface FloatHUDProps {
  mode: HudMode;
  missionState: MissionState;
  elapsedMs: number;
  hintCategory: string | null;
  onSubmit: () => void;
  onReset: () => void;
  onAbandon: () => void;
  onOpenSidebar: () => void;
}

export function FloatHUD({
  mode, missionState, elapsedMs, hintCategory,
  onSubmit, onReset, onAbandon, onOpenSidebar,
}: FloatHUDProps) {
  const [hintOpen, setHintOpen] = useState(false);

  if (mode === 'guide-onboard') {
    return (
      <div className="nv-float-hud nv-guide">
        <div className="nv-guide-header">// NEXUS-7 INITIALIZING</div>
        <div className="nv-guide-body">
          <div>&gt; Agent. First contact.</div>
          <div>&gt; Control center: left panel.</div>
        </div>
        <div className="nv-guide-footer">
          <button className="nv-btn nv-btn-guide-cta" onClick={onOpenSidebar}>
            Ctrl+P → Open Sidebar
          </button>
          <div className="nv-guide-cursor">█ awaiting confirmation_</div>
        </div>
      </div>
    );
  }

  if (mode === 'guide-idle') {
    return (
      <div className="nv-float-hud nv-guide">
        <div className="nv-guide-header">// NEXUS-7</div>
        <div className="nv-guide-body">
          <div>&gt; Ready.</div>
          <div>&gt; Missions in the control center.</div>
        </div>
        <div className="nv-guide-hint-text">→ Ctrl+P → &quot;Open Sidebar&quot;</div>
      </div>
    );
  }

  // mode === 'mission'
  const hints = getHintKeys(hintCategory, CHEATSHEET);
  const drillIndicator = missionState.drill_mode
    ? ` · >_ DRILL ×${missionState.drill_count}`
    : '';

  return (
    <div className="nv-float-hud" style={{ flexDirection: hintOpen ? 'column' : 'row' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span className="nv-hud-mission">
          {missionState.mission_id}{drillIndicator}
        </span>
        <span className="nv-hud-timer">{formatTime(elapsedMs)}</span>
        <div className="nv-hud-actions">
          <button className="nv-btn nv-btn-submit" onClick={onSubmit}>SUBMIT</button>
          <button className="nv-btn nv-btn-reset" onClick={onReset}>RESET</button>
          <button className="nv-btn nv-btn-abort" onClick={onAbandon}>ABORT</button>
          {hints.length > 0 && (
            <button
              className="nv-btn-hint"
              onClick={() => setHintOpen(o => !o)}
              style={{ color: hintOpen ? 'var(--nv-accent)' : 'var(--nv-accent-dim)' }}
            >?</button>
          )}
        </div>
      </div>
      {hintOpen && hints.length > 0 && (
        <div className="nv-hint-panel">
          {hints.map(k => (
            <div key={k.key} className="nv-hint-row">
              <span className="nv-hint-key">{k.key}</span>
              <span className="nv-hint-desc">{k.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
