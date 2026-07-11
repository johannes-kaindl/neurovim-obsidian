import { Chapter } from '../data/chapters';

export function isChapterUnlocked(chapter: Chapter, unlocked: string[]): boolean {
  return chapter.missions.some(m => unlocked.includes(m.id));
}

export function getChapterTarget(chapter: Chapter, completed: string[]): string {
  const mission = chapter.missions.find(m => !completed.includes(m.id)) ?? chapter.missions[0];
  return mission.briefing_path;
}

export function getChapterProgress(chapter: Chapter, completed: string[]): { done: number; total: number } {
  return {
    done: chapter.missions.filter(m => completed.includes(m.id)).length,
    total: chapter.missions.length,
  };
}
