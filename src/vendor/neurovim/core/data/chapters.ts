export interface ChapterMission {
  id: string;
  path: string;
  briefing_path: string;
  solution_path: string | null;
  corrupted_path: string | null;
}

export interface Chapter {
  id: string;
  label: string;
  missions: ChapterMission[];
}

const S = '_dev/SOLUTIONS';

export const CHAPTERS: Chapter[] = [
  {
    id: 'ch1',
    label: '01 INDOCTRINATION',
    missions: [
      { id: 'M-01', path: '_content/01 - Indoctrination/M-01-TRANSMISSION-The_Three_Modes.md',  briefing_path: '_content/01 - Indoctrination/M-01-BRIEFING-Induction_Order.md',   solution_path: `${S}/M-01-SOLUTION-The_Three_Modes.md`,  corrupted_path: `${S}/M-01-CORRUPTED-The_Three_Modes.md`  },
      { id: 'M-02', path: '_content/01 - Indoctrination/M-02-TRANSMISSION-Basic_Navigation.md', briefing_path: '_content/01 - Indoctrination/M-02-BRIEFING-Sector_Seven.md',      solution_path: `${S}/M-02-SOLUTION-Basic_Navigation.md`, corrupted_path: `${S}/M-02-CORRUPTED-Basic_Navigation.md` },
      { id: 'M-03', path: '_content/01 - Indoctrination/M-03-TRANSMISSION-Word_Movement.md',    briefing_path: '_content/01 - Indoctrination/M-03-BRIEFING-Agent_Roster.md',      solution_path: `${S}/M-03-SOLUTION-Word_Movement.md`,    corrupted_path: `${S}/M-03-CORRUPTED-Word_Movement.md`    },
      { id: 'M-04', path: '_content/01 - Indoctrination/M-04-TRANSMISSION-Lines_and_Jumps.md',  briefing_path: '_content/01 - Indoctrination/M-04-BRIEFING-Facility_Schematics.md', solution_path: `${S}/M-04-SOLUTION-Lines_and_Jumps.md`,  corrupted_path: `${S}/M-04-CORRUPTED-Lines_and_Jumps.md`  },
    ],
  },
  {
    id: 'ch2',
    label: '02 FIELD TRAINING',
    missions: [
      { id: 'M-05', path: '_content/02 - Field Training/M-05-TRANSMISSION-Operators.md',             briefing_path: '_content/02 - Field Training/M-05-BRIEFING-Access_Log_Alpha.md',    solution_path: `${S}/M-05-SOLUTION-Operators.md`,            corrupted_path: `${S}/M-05-CORRUPTED-Operators.md`            },
      { id: 'M-06', path: '_content/02 - Field Training/M-06-TRANSMISSION-Text_Objects.md',           briefing_path: '_content/02 - Field Training/M-06-BRIEFING-Cipher_Fragments.md',   solution_path: `${S}/M-06-SOLUTION-Text_Objects.md`,          corrupted_path: `${S}/M-06-CORRUPTED-Text_Objects.md`          },
      { id: 'M-07', path: '_content/02 - Field Training/M-07-TRANSMISSION-Search_and_Replace.md',     briefing_path: '_content/02 - Field Training/M-07-BRIEFING-Personnel_Matrix.md',   solution_path: `${S}/M-07-SOLUTION-Search_and_Replace.md`,    corrupted_path: `${S}/M-07-CORRUPTED-Search_and_Replace.md`    },
      { id: 'M-08', path: '_content/02 - Field Training/M-08-TRANSMISSION-Corrupted_Transmission.md', briefing_path: '_content/02 - Field Training/M-08-BRIEFING-Ghost_Transmission.md', solution_path: null,                                           corrupted_path: null                                           },
    ],
  },
  {
    id: 'ch3',
    label: '03 DEEP INFILTRATION',
    missions: [
      { id: 'M-09', path: '_content/03 - Deep Infiltration/M-09-TRANSMISSION-Marks_and_Macros.md',        briefing_path: '_content/03 - Deep Infiltration/M-09-BRIEFING-CORP_Internal_Memo.md', solution_path: `${S}/M-09-SOLUTION-Marks_and_Macros.md`,         corrupted_path: `${S}/M-09-CORRUPTED-Marks_and_Macros.md`         },
      { id: 'M-10', path: '_content/03 - Deep Infiltration/M-10-TRANSMISSION-Registers.md',               briefing_path: '_content/03 - Deep Infiltration/M-10-BRIEFING-Swapped_Chronology.md', solution_path: `${S}/M-10-SOLUTION-Registers.md`,                corrupted_path: `${S}/M-10-CORRUPTED-Registers.md`                },
      { id: 'M-11', path: '_content/03 - Deep Infiltration/M-11-TRANSMISSION-Bulletin_Drift.md',          briefing_path: '_content/03 - Deep Infiltration/M-11-BRIEFING-Bulletin_Drift.md',     solution_path: `${S}/M-11-SOLUTION-Bulletin_Drift.md`,           corrupted_path: `${S}/M-11-CORRUPTED-Bulletin_Drift.md`           },
      { id: 'M-12', path: '_content/03 - Deep Infiltration/M-12-TRANSMISSION-Anomaly_Classification.md',  briefing_path: '_content/03 - Deep Infiltration/M-12-BRIEFING-Anomaly_Classification.md', solution_path: `${S}/M-12-SOLUTION-Anomaly_Classification.md`, corrupted_path: `${S}/M-12-CORRUPTED-Anomaly_Classification.md` },
    ],
  },
  {
    id: 'ch4',
    label: '04 CHROME RAVEN',
    missions: [
      { id: 'M-13', path: '_content/04 - Chrome Raven/M-13-TRANSMISSION-Case_Cipher_Decryption.md', briefing_path: '_content/04 - Chrome Raven/M-13-BRIEFING-Case_Cipher_Decryption.md', solution_path: `${S}/M-13-SOLUTION-Case_Cipher_Decryption.md`, corrupted_path: `${S}/M-13-CORRUPTED-Case_Cipher_Decryption.md` },
      { id: 'M-14', path: '_content/04 - Chrome Raven/M-14-TRANSMISSION-Counter_Operations.md',     briefing_path: '_content/04 - Chrome Raven/M-14-BRIEFING-Counter_Operations.md',     solution_path: `${S}/M-14-SOLUTION-Counter_Operations.md`,    corrupted_path: `${S}/M-14-CORRUPTED-Counter_Operations.md`    },
      { id: 'M-15', path: '_content/04 - Chrome Raven/M-15-TRANSMISSION-Pattern_Rewriting.md',      briefing_path: '_content/04 - Chrome Raven/M-15-BRIEFING-Pattern_Rewriting.md',      solution_path: `${S}/M-15-SOLUTION-Pattern_Rewriting.md`,     corrupted_path: `${S}/M-15-CORRUPTED-Pattern_Rewriting.md`     },
      { id: 'M-16', path: '_content/04 - Chrome Raven/M-16-TRANSMISSION-Extraction_Window.md',      briefing_path: '_content/04 - Chrome Raven/M-16-BRIEFING-Extraction_Window.md',      solution_path: `${S}/M-16-SOLUTION-Extraction_Window.md`,     corrupted_path: `${S}/M-16-CORRUPTED-Extraction_Window.md`     },
    ],
  },
];

export const NEXUS_PATH = '00-NEXUS.md';
export const RAVEN_PATH = '99-THE_RAVEN.md';

export interface KataDefinition {
  id: string;
  title: string;
  path: string;
  solution_path: string;
  corrupted_path: string;
  category: string;
  xp_reward: number;
  difficulty: 1 | 2 | 3;
}

const K = '_content/KATAS';
const KS = '_dev/SOLUTIONS';

export const KATAS: KataDefinition[] = [
  { id: 'KATA-01', title: 'WORD SPRINT',        path: `${K}/KATA-01-TRANSMISSION-Word_Sprint.md`,         solution_path: `${KS}/KATA-01-SOLUTION-Word_Sprint.md`,         corrupted_path: `${KS}/KATA-01-CORRUPTED-Word_Sprint.md`,         category: 'navigation',   xp_reward: 10, difficulty: 1 },
  { id: 'KATA-02', title: 'OPERATOR STRIKE',    path: `${K}/KATA-02-TRANSMISSION-Operator_Strike.md`,     solution_path: `${KS}/KATA-02-SOLUTION-Operator_Strike.md`,     corrupted_path: `${KS}/KATA-02-CORRUPTED-Operator_Strike.md`,     category: 'operators',    xp_reward: 10, difficulty: 2 },
  { id: 'KATA-03', title: 'OBJECT INFILTRATION',path: `${K}/KATA-03-TRANSMISSION-Object_Infiltration.md`, solution_path: `${KS}/KATA-03-SOLUTION-Object_Infiltration.md`, corrupted_path: `${KS}/KATA-03-CORRUPTED-Object_Infiltration.md`, category: 'text-objects', xp_reward: 10, difficulty: 2 },
  { id: 'KATA-04', title: 'ECHO TRACE',         path: `${K}/KATA-04-TRANSMISSION-Echo_Trace.md`,          solution_path: `${KS}/KATA-04-SOLUTION-Echo_Trace.md`,          corrupted_path: `${KS}/KATA-04-CORRUPTED-Echo_Trace.md`,          category: 'search-replace', xp_reward: 10, difficulty: 2 },
  { id: 'KATA-05', title: 'LINE SPLICE',         path: `${K}/KATA-05-TRANSMISSION-Line_Splice.md`,         solution_path: `${KS}/KATA-05-SOLUTION-Line_Splice.md`,         corrupted_path: `${KS}/KATA-05-CORRUPTED-Line_Splice.md`,         category: 'operators',      xp_reward: 10, difficulty: 2 },
  { id: 'KATA-06', title: 'VISUAL SWEEP',        path: `${K}/KATA-06-TRANSMISSION-Visual_Sweep.md`,        solution_path: `${KS}/KATA-06-SOLUTION-Visual_Sweep.md`,        corrupted_path: `${KS}/KATA-06-CORRUPTED-Visual_Sweep.md`,        category: 'visual-block',   xp_reward: 15, difficulty: 3 },
  { id: 'KATA-07', title: 'LITERAL BURN',        path: `${K}/KATA-07-TRANSMISSION-Literal_Burn.md`,        solution_path: `${KS}/KATA-07-SOLUTION-Literal_Burn.md`,        corrupted_path: `${KS}/KATA-07-CORRUPTED-Literal_Burn.md`,        category: 'regex',          xp_reward: 15, difficulty: 2 },
  { id: 'KATA-08', title: 'WILDCARD HUNT',       path: `${K}/KATA-08-TRANSMISSION-Wildcard_Hunt.md`,       solution_path: `${KS}/KATA-08-SOLUTION-Wildcard_Hunt.md`,       corrupted_path: `${KS}/KATA-08-CORRUPTED-Wildcard_Hunt.md`,       category: 'regex',          xp_reward: 15, difficulty: 2 },
  { id: 'KATA-09', title: 'CLASS ACTION',        path: `${K}/KATA-09-TRANSMISSION-Class_Action.md`,        solution_path: `${KS}/KATA-09-SOLUTION-Class_Action.md`,        corrupted_path: `${KS}/KATA-09-CORRUPTED-Class_Action.md`,        category: 'regex',          xp_reward: 15, difficulty: 3 },
  { id: 'KATA-10', title: 'CAPTURE NET',         path: `${K}/KATA-10-TRANSMISSION-Capture_Net.md`,         solution_path: `${KS}/KATA-10-SOLUTION-Capture_Net.md`,         corrupted_path: `${KS}/KATA-10-CORRUPTED-Capture_Net.md`,         category: 'regex',          xp_reward: 15, difficulty: 3 },
  { id: 'KATA-11', title: 'MIRROR FINAL',        path: `${K}/KATA-11-TRANSMISSION-Mirror_Final.md`,        solution_path: `${KS}/KATA-11-SOLUTION-Mirror_Final.md`,        corrupted_path: `${KS}/KATA-11-CORRUPTED-Mirror_Final.md`,        category: 'regex',          xp_reward: 15, difficulty: 3 },
  { id: 'KATA-12', title: 'TARGET LOCK',         path: `${K}/KATA-12-TRANSMISSION-Target_Lock.md`,         solution_path: `${KS}/KATA-12-SOLUTION-Target_Lock.md`,         corrupted_path: `${KS}/KATA-12-CORRUPTED-Target_Lock.md`,         category: 'navigation',   xp_reward: 10, difficulty: 1 },
  { id: 'KATA-13', title: 'ECHO',                path: `${K}/KATA-13-TRANSMISSION-Echo.md`,                solution_path: `${KS}/KATA-13-SOLUTION-Echo.md`,                corrupted_path: `${KS}/KATA-13-CORRUPTED-Echo.md`,                category: 'fundamentals', xp_reward: 10, difficulty: 2 },
  { id: 'KATA-14', title: 'DRAGNET',             path: `${K}/KATA-14-TRANSMISSION-Dragnet.md`,             solution_path: `${KS}/KATA-14-SOLUTION-Dragnet.md`,             corrupted_path: `${KS}/KATA-14-CORRUPTED-Dragnet.md`,             category: 'ex-commands',  xp_reward: 10, difficulty: 3 },
];

const A2 = '_content';
const A2S = '_dev/SOLUTIONS';

export const ARC2_CHAPTERS: Chapter[] = [
  {
    id: 'ch5',
    label: '05 LITERAL FREQUENCIES',
    missions: [
      { id: 'R-01', path: `${A2}/05 - Literal Frequencies/R-01-TRANSMISSION-Signal_Substitution.md`, briefing_path: `${A2}/05 - Literal Frequencies/R-01-BRIEFING-Signal_Substitution.md`, solution_path: `${A2S}/R-01-SOLUTION-Signal_Substitution.md`, corrupted_path: `${A2S}/R-01-CORRUPTED-Signal_Substitution.md` },
      { id: 'R-02', path: `${A2}/05 - Literal Frequencies/R-02-TRANSMISSION-Silent_Flag.md`,         briefing_path: `${A2}/05 - Literal Frequencies/R-02-BRIEFING-Silent_Flag.md`,         solution_path: `${A2S}/R-02-SOLUTION-Silent_Flag.md`,         corrupted_path: `${A2S}/R-02-CORRUPTED-Silent_Flag.md`         },
      { id: 'R-03', path: `${A2}/05 - Literal Frequencies/R-03-TRANSMISSION-Trace_Purge.md`,         briefing_path: `${A2}/05 - Literal Frequencies/R-03-BRIEFING-Trace_Purge.md`,         solution_path: `${A2S}/R-03-SOLUTION-Trace_Purge.md`,         corrupted_path: `${A2S}/R-03-CORRUPTED-Trace_Purge.md`         },
      { id: 'R-04', path: `${A2}/05 - Literal Frequencies/R-04-TRANSMISSION-Range_Strike.md`,        briefing_path: `${A2}/05 - Literal Frequencies/R-04-BRIEFING-Range_Strike.md`,        solution_path: `${A2S}/R-04-SOLUTION-Range_Strike.md`,        corrupted_path: `${A2S}/R-04-CORRUPTED-Range_Strike.md`        },
    ],
  },
  {
    id: 'ch6',
    label: '06 WILDCARD PROTOCOL',
    missions: [
      { id: 'R-05', path: `${A2}/06 - Wildcard Protocol/R-05-TRANSMISSION-Dot_Sweep.md`,       briefing_path: `${A2}/06 - Wildcard Protocol/R-05-BRIEFING-Dot_Sweep.md`,       solution_path: `${A2S}/R-05-SOLUTION-Dot_Sweep.md`,       corrupted_path: `${A2S}/R-05-CORRUPTED-Dot_Sweep.md`       },
      { id: 'R-06', path: `${A2}/06 - Wildcard Protocol/R-06-TRANSMISSION-Frequency_Match.md`, briefing_path: `${A2}/06 - Wildcard Protocol/R-06-BRIEFING-Frequency_Match.md`, solution_path: `${A2S}/R-06-SOLUTION-Frequency_Match.md`, corrupted_path: `${A2S}/R-06-CORRUPTED-Frequency_Match.md` },
      { id: 'R-07', path: `${A2}/06 - Wildcard Protocol/R-07-TRANSMISSION-Lazy_Trace.md`,      briefing_path: `${A2}/06 - Wildcard Protocol/R-07-BRIEFING-Lazy_Trace.md`,      solution_path: `${A2S}/R-07-SOLUTION-Lazy_Trace.md`,      corrupted_path: `${A2S}/R-07-CORRUPTED-Lazy_Trace.md`      },
      { id: 'R-08', path: `${A2}/06 - Wildcard Protocol/R-08-TRANSMISSION-Magic_Mode.md`,      briefing_path: `${A2}/06 - Wildcard Protocol/R-08-BRIEFING-Magic_Mode.md`,      solution_path: `${A2S}/R-08-SOLUTION-Magic_Mode.md`,      corrupted_path: `${A2S}/R-08-CORRUPTED-Magic_Mode.md`      },
    ],
  },
  {
    id: 'ch7',
    label: '07 CODEX MATRIX',
    missions: [
      { id: 'R-09', path: `${A2}/07 - Codex Matrix/R-09-TRANSMISSION-Set_Theory.md`,       briefing_path: `${A2}/07 - Codex Matrix/R-09-BRIEFING-Set_Theory.md`,       solution_path: `${A2S}/R-09-SOLUTION-Set_Theory.md`,       corrupted_path: `${A2S}/R-09-CORRUPTED-Set_Theory.md`       },
      { id: 'R-10', path: `${A2}/07 - Codex Matrix/R-10-TRANSMISSION-Digit_Sweep.md`,      briefing_path: `${A2}/07 - Codex Matrix/R-10-BRIEFING-Digit_Sweep.md`,      solution_path: `${A2S}/R-10-SOLUTION-Digit_Sweep.md`,      corrupted_path: `${A2S}/R-10-CORRUPTED-Digit_Sweep.md`      },
      { id: 'R-11', path: `${A2}/07 - Codex Matrix/R-11-TRANSMISSION-Inverse_Filter.md`,   briefing_path: `${A2}/07 - Codex Matrix/R-11-BRIEFING-Inverse_Filter.md`,   solution_path: `${A2S}/R-11-SOLUTION-Inverse_Filter.md`,   corrupted_path: `${A2S}/R-11-CORRUPTED-Inverse_Filter.md`   },
      { id: 'R-12', path: `${A2}/07 - Codex Matrix/R-12-TRANSMISSION-Combined_Strike.md`,  briefing_path: `${A2}/07 - Codex Matrix/R-12-BRIEFING-Combined_Strike.md`,  solution_path: `${A2S}/R-12-SOLUTION-Combined_Strike.md`,  corrupted_path: `${A2S}/R-12-CORRUPTED-Combined_Strike.md`  },
    ],
  },
  {
    id: 'ch8',
    label: '08 ANCHOR DOCTRINE',
    missions: [
      { id: 'R-13', path: `${A2}/08 - Anchor Doctrine/R-13-TRANSMISSION-Line_Zero.md`,      briefing_path: `${A2}/08 - Anchor Doctrine/R-13-BRIEFING-Line_Zero.md`,      solution_path: `${A2S}/R-13-SOLUTION-Line_Zero.md`,      corrupted_path: `${A2S}/R-13-CORRUPTED-Line_Zero.md`      },
      { id: 'R-14', path: `${A2}/08 - Anchor Doctrine/R-14-TRANSMISSION-Tail_Mark.md`,      briefing_path: `${A2}/08 - Anchor Doctrine/R-14-BRIEFING-Tail_Mark.md`,      solution_path: `${A2S}/R-14-SOLUTION-Tail_Mark.md`,      corrupted_path: `${A2S}/R-14-CORRUPTED-Tail_Mark.md`      },
      { id: 'R-15', path: `${A2}/08 - Anchor Doctrine/R-15-TRANSMISSION-Boundary_Scan.md`,  briefing_path: `${A2}/08 - Anchor Doctrine/R-15-BRIEFING-Boundary_Scan.md`,  solution_path: `${A2S}/R-15-SOLUTION-Boundary_Scan.md`,  corrupted_path: `${A2S}/R-15-CORRUPTED-Boundary_Scan.md`  },
      { id: 'R-16', path: `${A2}/08 - Anchor Doctrine/R-16-TRANSMISSION-Full_Anchor.md`,    briefing_path: `${A2}/08 - Anchor Doctrine/R-16-BRIEFING-Full_Anchor.md`,    solution_path: `${A2S}/R-16-SOLUTION-Full_Anchor.md`,    corrupted_path: `${A2S}/R-16-CORRUPTED-Full_Anchor.md`    },
    ],
  },
  {
    id: 'ch9',
    label: '09 CAPTURE OPERATION',
    missions: [
      { id: 'R-17', path: `${A2}/09 - Capture Operation/R-17-TRANSMISSION-First_Capture.md`, briefing_path: `${A2}/09 - Capture Operation/R-17-BRIEFING-First_Capture.md`, solution_path: `${A2S}/R-17-SOLUTION-First_Capture.md`, corrupted_path: `${A2S}/R-17-CORRUPTED-First_Capture.md` },
      { id: 'R-18', path: `${A2}/09 - Capture Operation/R-18-TRANSMISSION-Mirror_Word.md`,   briefing_path: `${A2}/09 - Capture Operation/R-18-BRIEFING-Mirror_Word.md`,   solution_path: `${A2S}/R-18-SOLUTION-Mirror_Word.md`,   corrupted_path: `${A2S}/R-18-CORRUPTED-Mirror_Word.md`   },
      { id: 'R-19', path: `${A2}/09 - Capture Operation/R-19-TRANSMISSION-Format_Shift.md`,  briefing_path: `${A2}/09 - Capture Operation/R-19-BRIEFING-Format_Shift.md`,  solution_path: `${A2S}/R-19-SOLUTION-Format_Shift.md`,  corrupted_path: `${A2S}/R-19-CORRUPTED-Format_Shift.md`  },
      { id: 'R-20', path: `${A2}/09 - Capture Operation/R-20-TRANSMISSION-Multi_Group.md`,   briefing_path: `${A2}/09 - Capture Operation/R-20-BRIEFING-Multi_Group.md`,   solution_path: `${A2S}/R-20-SOLUTION-Multi_Group.md`,   corrupted_path: `${A2S}/R-20-CORRUPTED-Multi_Group.md`   },
    ],
  },
  {
    id: 'ch10',
    label: '10 MIRROR REWRITE',
    missions: [
      { id: 'R-21', path: `${A2}/10 - Mirror Rewrite/R-21-TRANSMISSION-Global_Strike.md`,   briefing_path: `${A2}/10 - Mirror Rewrite/R-21-BRIEFING-Global_Strike.md`,   solution_path: `${A2S}/R-21-SOLUTION-Global_Strike.md`,   corrupted_path: `${A2S}/R-21-CORRUPTED-Global_Strike.md`   },
      { id: 'R-22', path: `${A2}/10 - Mirror Rewrite/R-22-TRANSMISSION-Inverse_Delete.md`,  briefing_path: `${A2}/10 - Mirror Rewrite/R-22-BRIEFING-Inverse_Delete.md`,  solution_path: `${A2S}/R-22-SOLUTION-Inverse_Delete.md`,  corrupted_path: `${A2S}/R-22-CORRUPTED-Inverse_Delete.md`  },
      { id: 'R-23', path: `${A2}/10 - Mirror Rewrite/R-23-TRANSMISSION-Cascade.md`,         briefing_path: `${A2}/10 - Mirror Rewrite/R-23-BRIEFING-Cascade.md`,         solution_path: `${A2S}/R-23-SOLUTION-Cascade.md`,         corrupted_path: `${A2S}/R-23-CORRUPTED-Cascade.md`         },
      { id: 'R-24', path: `${A2}/10 - Mirror Rewrite/R-24-TRANSMISSION-Project_Mirror.md`,  briefing_path: `${A2}/10 - Mirror Rewrite/R-24-BRIEFING-Project_Mirror.md`,  solution_path: `${A2S}/R-24-SOLUTION-Project_Mirror.md`,  corrupted_path: `${A2S}/R-24-CORRUPTED-Project_Mirror.md`  },
    ],
  },
];

export const ALL_CHAPTERS = [...CHAPTERS, ...ARC2_CHAPTERS];

export function getMissionById(id: string): ChapterMission | KataDefinition | undefined {
  for (const ch of ALL_CHAPTERS) {
    const m = ch.missions.find(m => m.id === id);
    if (m) return m;
  }
  return KATAS.find(k => k.id === id);
}

export function getMissionByPath(path: string): ChapterMission | KataDefinition | undefined {
  for (const ch of ALL_CHAPTERS) {
    const m = ch.missions.find(m => m.path === path);
    if (m) return m;
  }
  return KATAS.find(k => k.path === path);
}

export function isBriefingPath(path: string): boolean {
  return ALL_CHAPTERS.some(ch => ch.missions.some(m => m.briefing_path === path));
}
