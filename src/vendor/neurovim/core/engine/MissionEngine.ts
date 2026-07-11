import { getDiff } from '../utils/diff';
import { DiffResult } from '../types';

export class MissionEngine {
  static verify(currentContent: string, solutionContent: string): DiffResult {
    return getDiff(currentContent, solutionContent);
  }

  static isMissionPracticeFile(frontmatter: Record<string, unknown> | null): boolean {
    return frontmatter?.['mission_type'] === 'practice';
  }

  static buildPracticeFrontmatter(existing: string, mission_id: string, locked: boolean): string {
    if (existing.startsWith('---')) return existing;
    return `---\nmission_type: practice\nmission_id: ${mission_id}\nlocked: ${locked}\n---\n\n${existing}`;
  }
}
