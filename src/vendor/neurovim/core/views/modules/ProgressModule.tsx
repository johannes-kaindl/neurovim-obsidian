import React from 'react';
import { PluginData } from '../../types';
import { LEVELS } from '../../data/levels';
import { ProgressionEngine } from '../../engine/ProgressionEngine';

interface ProgressModuleProps {
  pluginData: PluginData;
}

export function ProgressModule({ pluginData }: ProgressModuleProps) {
  const level = ProgressionEngine.getLevelForXp(pluginData.total_xp);
  const levelData = ProgressionEngine.getLevelData(level);
  const nextLevelData = LEVELS.find(l => l.level === level + 1);
  const xpForNext = nextLevelData ? nextLevelData.xp_required - pluginData.total_xp : 0;
  const xpInLevel = pluginData.total_xp - levelData.xp_required;
  const xpRange = nextLevelData ? nextLevelData.xp_required - levelData.xp_required : 1;
  const progress = nextLevelData ? Math.round((xpInLevel / xpRange) * 100) : 100;

  return (
    <div className="nv-module nv-module-progress">
      <div className="nv-progress-level" style={{ color: levelData.color }}>
        LVL {level} — {levelData.title}
      </div>
      <div className="nv-progress-xp">{pluginData.total_xp} XP total</div>
      {nextLevelData && (
        <>
          <div className="nv-progress-bar">
            <div className="nv-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="nv-progress-next">{xpForNext} XP to next level</div>
        </>
      )}
      <div className="nv-progress-streak">
        STREAK: {pluginData.streak_current} {pluginData.streak_current > 0 ? '◆' : '◇'}
      </div>
    </div>
  );
}
