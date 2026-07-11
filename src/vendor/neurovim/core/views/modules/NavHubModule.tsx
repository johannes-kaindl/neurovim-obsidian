import React, { useState } from 'react';
import { Chapter, CHAPTERS, ARC2_CHAPTERS, KATAS, NEXUS_PATH, RAVEN_PATH } from '../../data/chapters';
import { isChapterUnlocked, getChapterProgress } from '../../utils/chapterNav';

interface NavHubModuleProps {
  unlocked: string[];
  completedMissions: string[];
  onOpenFile: (path: string) => void;
  ambientEnabled?: boolean;
  onToggleAmbient?: () => void;
}

export function NavHubModule({ unlocked, completedMissions, onOpenFile, ambientEnabled, onToggleAmbient }: NavHubModuleProps) {
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);

  if (selectedChapter) {
    return (
      <div className="nv-navhub">
        <button className="nv-navhub-back" onClick={() => setSelectedChapter(null)}>
          {'< BACK'}
        </button>
        <div className="nv-navhub-detail-header">{selectedChapter.label}</div>
        <div className="nv-navhub-chapters">
          {selectedChapter.missions.map(mission => {
            const done = completedMissions.includes(mission.id);
            const locked = !unlocked.includes(mission.id);
            const num = mission.id.replace('M-', '');
            if (locked) {
              return (
                <div key={mission.id} className="nv-navhub-chapter nv-navhub-chapter-locked">
                  <span>MISSION-{num}</span>
                  <span className="nv-navhub-chapter-meta">[LOCKED]</span>
                </div>
              );
            }
            return (
              <button
                key={mission.id}
                className={`nv-navhub-chapter${done ? ' nv-navhub-chapter-done' : ''}`}
                onClick={() => onOpenFile(mission.briefing_path)}
              >
                <span>MISSION-{num}{done ? ' ✓' : ''}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="nv-navhub">
      <div className="nv-navhub-primary">
        <button className="nv-btn nv-btn-nexus" onClick={() => onOpenFile(NEXUS_PATH)}>
          NEXUS
        </button>
        <button className="nv-btn" onClick={() => onOpenFile(RAVEN_PATH)}>
          THE RAVEN
        </button>
        {onToggleAmbient && (
          <span
            className="nv-ambient-toggle"
            title={ambientEnabled ? 'Ambient: ON (click to disable)' : 'Ambient: OFF (click to enable)'}
            onClick={onToggleAmbient}
            style={{ cursor: 'pointer', opacity: ambientEnabled ? 1 : 0.4, userSelect: 'none', fontSize: '0.8em', marginLeft: '0.5em' }}
          >
            {ambientEnabled ? '[SND]' : '[---]'}
          </span>
        )}
      </div>

      <div className="nv-navhub-arc-header">// ARC I — FIELD TRAINING</div>
      <div className="nv-navhub-chapters">
        {CHAPTERS.map(chapter => {
          const accessible = isChapterUnlocked(chapter, unlocked);
          const { done, total } = getChapterProgress(chapter, completedMissions);
          const allDone = done === total;

          if (!accessible) {
            return (
              <div key={chapter.id} className="nv-navhub-chapter nv-navhub-chapter-locked">
                <span>{chapter.label}</span>
                <span className="nv-navhub-chapter-meta">[LOCKED]</span>
              </div>
            );
          }

          return (
            <button
              key={chapter.id}
              className="nv-navhub-chapter"
              onClick={() => setSelectedChapter(chapter)}
            >
              <span>{chapter.label}{allDone ? ' ✓' : ''}</span>
              <span className="nv-navhub-chapter-meta">{done}/{total}</span>
            </button>
          );
        })}
      </div>

      {ARC2_CHAPTERS.some(ch => isChapterUnlocked(ch, unlocked)) && (
        <>
          <div className="nv-navhub-arc-header">// ARC II — CIPHER PROTOCOL</div>
          <div className="nv-navhub-chapters">
            {ARC2_CHAPTERS.map(chapter => {
              const accessible = isChapterUnlocked(chapter, unlocked);
              const { done, total } = getChapterProgress(chapter, completedMissions);
              const allDone = done === total;

              if (!accessible) {
                return (
                  <div key={chapter.id} className="nv-navhub-chapter nv-navhub-chapter-locked">
                    <span>{chapter.label}</span>
                    <span className="nv-navhub-chapter-meta">[LOCKED]</span>
                  </div>
                );
              }

              return (
                <button
                  key={chapter.id}
                  className="nv-navhub-chapter"
                  onClick={() => setSelectedChapter(chapter)}
                >
                  <span>{chapter.label}{allDone ? ' ✓' : ''}</span>
                  <span className="nv-navhub-chapter-meta">{done}/{total}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="nv-navhub-classified">// LOOT — CLASSIFIED</div>

      <div className="nv-navhub-katas">
        <div className="nv-navhub-katas-header">// KATAS</div>
        {KATAS.map(kata => {
          const accessible = unlocked.includes(kata.id);
          const done = completedMissions.includes(kata.id);
          const dots = '·'.repeat(kata.difficulty);
          if (!accessible) {
            return (
              <div key={kata.id} className="nv-navhub-chapter nv-navhub-chapter-locked">
                <span>{kata.id}</span>
                <span className="nv-navhub-chapter-meta">[LOCKED]</span>
              </div>
            );
          }
          return (
            <button
              key={kata.id}
              className={`nv-navhub-chapter${done ? ' nv-navhub-chapter-done' : ''}`}
              onClick={() => onOpenFile(kata.path)}
            >
              <span>{kata.id}{done ? ' ✓' : ''}</span>
              <span className="nv-kata-meta">
                <span className="nv-kata-dots">{dots}</span>
                <span className="nv-kata-badge">{kata.category}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
