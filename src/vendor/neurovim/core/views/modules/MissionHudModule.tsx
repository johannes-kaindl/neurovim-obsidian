import React from 'react';
import { MissionState, MissionRecord, PluginData } from '../../types';
import { formatTime } from '../../utils/time';

interface MissionHudModuleProps {
  missionState: MissionState;
  elapsedMs: number;
  record: MissionRecord | null;
  pluginData: PluginData;
  onSubmit: () => void;
  onReset: () => void;
  onAbandon: () => void;
}

export function MissionHudModule({
  missionState, elapsedMs, record, onSubmit, onReset, onAbandon,
}: MissionHudModuleProps) {
  if (missionState.status !== 'active') {
    return (
      <div className="nv-module nv-module-hud">
        <div className="nv-module-empty">&gt;_ NO ACTIVE MISSION</div>
      </div>
    );
  }

  const bestMs = record?.best_time_ms;
  const progress = bestMs ? Math.min(100, Math.round((elapsedMs / bestMs) * 100)) : null;

  return (
    <div className="nv-module nv-module-hud">
      <div className="nv-hud-timer-large">{formatTime(elapsedMs)}</div>
      <div className="nv-hud-meta">
        {missionState.mission_id} · +{missionState.xp_reward} XP
        {bestMs && <span> · Best: {formatTime(bestMs)}</span>}
      </div>
      {progress !== null && (
        <div className="nv-progress-bar">
          <div
            className="nv-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {missionState.drill_mode && (
        <div className="nv-drill-indicator">&gt;_ DRILL ×{missionState.drill_count}</div>
      )}
      <div className="nv-hud-actions">
        <button className="nv-btn nv-btn-submit" onClick={onSubmit}>SUBMIT</button>
        <button className="nv-btn nv-btn-reset" onClick={onReset}>RESET</button>
        <button className="nv-btn nv-btn-abort" onClick={onAbandon}>ABORT</button>
      </div>
    </div>
  );
}
