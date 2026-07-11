export interface Keybinding {
  key: string;
  description: string;
}

export interface CheatsheetCategory {
  id: string;
  label: string;
  groups: { label: string; keys: Keybinding[] }[];
}

export const CHEATSHEET: CheatsheetCategory[] = [
  {
    id: 'fundamentals',
    label: 'FUNDAMENTALS',
    groups: [
      {
        label: 'MODES',
        keys: [
          { key: 'i',   description: 'insert before cursor' },
          { key: 'a',   description: 'insert after cursor' },
          { key: 'o',   description: 'new line below, insert' },
          { key: 'O',   description: 'new line above, insert' },
          { key: 'ESC', description: 'back to normal' },
        ],
      },
      {
        label: 'EDIT',
        keys: [
          { key: 'x',  description: 'delete char under cursor' },
          { key: 'X',  description: 'delete char before cursor' },
          { key: 'r',  description: 'replace single char' },
          { key: '.',  description: 'repeat last change' },
          { key: 'u',  description: 'undo' },
          { key: 'Ctrl+r', description: 'redo' },
        ],
      },
    ],
  },
  {
    id: 'navigation',
    label: 'NAVIGATION',
    groups: [
      {
        label: 'BASIC MOVE',
        keys: [
          { key: 'h',  description: 'left' },
          { key: 'j',  description: 'down' },
          { key: 'k',  description: 'up' },
          { key: 'l',  description: 'right' },
          { key: '0',  description: 'line start' },
          { key: '^',  description: 'first non-blank' },
          { key: '$',  description: 'line end' },
        ],
      },
      {
        label: 'FILE JUMPS',
        keys: [
          { key: 'gg',  description: 'file start' },
          { key: 'G',   description: 'file end' },
          { key: ':#',  description: 'jump to line number' },
          { key: 'H',   description: 'top of screen' },
          { key: 'M',   description: 'middle of screen' },
          { key: 'L',   description: 'bottom of screen' },
        ],
      },
      {
        label: 'FIND CHAR',
        keys: [
          { key: 'f',  description: 'jump to next <char>' },
          { key: 'F',  description: 'jump to previous <char>' },
          { key: 't',  description: 'jump just before next <char>' },
          { key: 'T',  description: 'jump just before previous <char>' },
          { key: ';',  description: 'repeat last f/F/t/T' },
          { key: ',',  description: 'repeat it, reversed' },
        ],
      },
      {
        label: 'SCROLL',
        keys: [
          { key: 'Ctrl+d', description: 'half page down' },
          { key: 'Ctrl+u', description: 'half page up' },
          { key: '{',      description: 'prev paragraph' },
          { key: '}',      description: 'next paragraph' },
        ],
      },
    ],
  },
  {
    id: 'word-movement',
    label: 'WORD MOVEMENT',
    groups: [
      {
        label: 'WORD JUMP',
        keys: [
          { key: 'w', description: 'next word start' },
          { key: 'b', description: 'prev word start' },
          { key: 'e', description: 'word end' },
          { key: 'W', description: 'next WORD start' },
          { key: 'B', description: 'prev WORD start' },
          { key: 'E', description: 'WORD end' },
        ],
      },
    ],
  },
  {
    id: 'operators',
    label: 'OPERATORS',
    groups: [
      {
        label: 'DELETE',
        keys: [
          { key: 'dw', description: 'delete word' },
          { key: 'dd', description: 'delete line' },
          { key: 'D',  description: 'delete to end of line' },
          { key: 'diw', description: 'delete inner word' },
          { key: '3dd', description: 'delete 3 lines' },
        ],
      },
      {
        label: 'CHANGE',
        keys: [
          { key: 'cw', description: 'change word' },
          { key: 'cc', description: 'change line' },
          { key: 'C',  description: 'change to end of line' },
        ],
      },
      {
        label: 'YANK/PUT',
        keys: [
          { key: 'yy', description: 'yank line' },
          { key: 'yw', description: 'yank word' },
          { key: 'p',  description: 'put after' },
          { key: 'P',  description: 'put before' },
          { key: 'Vp', description: 'select line, replace with yanked' },
        ],
      },
    ],
  },
  {
    id: 'text-objects',
    label: 'TEXT OBJECTS',
    groups: [
      {
        label: 'INSIDE',
        keys: [
          { key: 'ciw', description: 'change inside word' },
          { key: 'ci"', description: 'change inside quotes' },
          { key: 'ci(',  description: 'change inside parens' },
          { key: 'ci{',  description: 'change inside braces' },
          { key: 'ci[',  description: 'change inside brackets' },
          { key: 'cit',  description: 'change inside tag' },
        ],
      },
      {
        label: 'AROUND',
        keys: [
          { key: 'daw', description: 'delete around word' },
          { key: 'ca"', description: 'change around quotes' },
          { key: 'da(', description: 'delete around parens' },
          { key: 'diw', description: 'delete inner word' },
        ],
      },
    ],
  },
  {
    id: 'search-replace',
    label: 'SEARCH & REPLACE',
    groups: [
      {
        label: 'SEARCH',
        keys: [
          { key: '/pattern', description: 'search forward' },
          { key: '?pattern', description: 'search backward' },
          { key: 'n',        description: 'next match' },
          { key: 'N',        description: 'prev match' },
          { key: '*',        description: 'search word under cursor' },
          { key: 'cgn',      description: 'change next match' },
          { key: '.',        description: 'repeat last change' },
        ],
      },
      {
        label: 'REPLACE',
        keys: [
          { key: ':%s/old/new/g',  description: 'replace all in file' },
          { key: ':s/old/new/g',   description: 'replace in line' },
          { key: ':%s/old/new/gc', description: 'replace with confirm' },
        ],
      },
    ],
  },
  {
    id: 'marks-macros',
    label: 'MARKS & MACROS',
    groups: [
      {
        label: 'MARKS',
        keys: [
          { key: 'ma',   description: 'set mark a' },
          { key: '`a',   description: 'jump to mark a (exact)' },
          { key: "'a",   description: "jump to mark a (line)" },
          { key: "''",   description: 'jump back' },
        ],
      },
      {
        label: 'MACROS',
        keys: [
          { key: 'qa',   description: 'record macro into a' },
          { key: 'q',    description: 'stop recording' },
          { key: '@a',   description: 'play macro a' },
          { key: '@@',   description: 'replay last macro' },
          { key: '12@a', description: 'play macro 12 times' },
          { key: ':norm', description: 'run normal cmd on range' },
        ],
      },
    ],
  },
  {
    id: 'registers',
    label: 'REGISTERS',
    groups: [
      {
        label: 'NAMED REGISTERS',
        keys: [
          { key: '"ayy', description: 'yank line into register a' },
          { key: '"ay',  description: 'yank motion into register a' },
          { key: '"add', description: 'delete line into register a' },
          { key: '"ap',  description: 'paste from register a' },
          { key: '"aP',  description: 'paste before from register a' },
        ],
      },
      {
        label: 'SPECIAL',
        keys: [
          { key: '"1p',  description: 'paste from numbered register 1' },
          { key: '"+y',  description: 'yank to system clipboard' },
          { key: '"+p',  description: 'paste from system clipboard' },
          { key: ':reg', description: 'show all registers' },
        ],
      },
    ],
  },
  {
    id: 'pane-nav',
    label: 'PANE NAVIGATION',
    groups: [
      {
        label: 'SWITCH',
        keys: [
          { key: 'Ctrl+Tab',   description: 'next pane' },
          { key: 'Ctrl+W h',   description: 'move to left pane' },
          { key: 'Ctrl+W l',   description: 'move to right pane' },
          { key: 'Ctrl+W j',   description: 'move to pane below' },
          { key: 'Ctrl+W k',   description: 'move to pane above' },
        ],
      },
      {
        label: 'SPLIT',
        keys: [
          { key: ':sp',  description: 'split horizontal' },
          { key: ':vsp', description: 'split vertical' },
        ],
      },
    ],
  },
  {
    id: 'ex-commands',
    label: 'EX COMMANDS',
    groups: [
      {
        label: 'GLOBAL',
        keys: [
          { key: ':g/pattern/d',       description: 'delete all matching lines' },
          { key: ':v/pattern/d',       description: 'delete all non-matching lines' },
          { key: ':g/pattern/s/x/y/',  description: 'replace in matching lines' },
          { key: ":g/pattern/norm cmd",description: 'run normal cmd on matches' },
        ],
      },
      {
        label: 'RANGES',
        keys: [
          { key: ":'<,'>s/x/y/",  description: 'replace in visual selection' },
          { key: ':1,10s/x/y/',   description: 'replace in line range' },
          { key: ':.,$s/x/y/',    description: 'replace from cursor to end' },
        ],
      },
    ],
  },
  {
    id: 'case',
    label: 'CASE CONVERSION',
    groups: [
      {
        label: 'TOGGLE / UPPER / LOWER',
        keys: [
          { key: '~',    description: 'toggle case of char' },
          { key: 'g~~',  description: 'toggle case of line' },
          { key: 'gUU',  description: 'uppercase line' },
          { key: 'guu',  description: 'lowercase line' },
          { key: 'gU{motion}', description: 'uppercase motion' },
          { key: 'gu{motion}', description: 'lowercase motion' },
        ],
      },
      {
        label: 'VISUAL',
        keys: [
          { key: 'viwU', description: 'select word, uppercase' },
          { key: 'viwu', description: 'select word, lowercase' },
          { key: 'U',    description: 'uppercase selection' },
          { key: 'u',    description: 'lowercase selection' },
        ],
      },
    ],
  },
  {
    id: 'visual-block',
    label: 'VISUAL BLOCK',
    groups: [
      {
        label: 'SELECT',
        keys: [
          { key: 'Ctrl+v',  description: 'enter visual block mode' },
          { key: 'V',       description: 'select whole line' },
          { key: 'v',       description: 'character visual mode' },
          { key: 'o',       description: 'toggle selection end' },
        ],
      },
      {
        label: 'ACT ON SELECTION',
        keys: [
          { key: 'd',       description: 'delete selection' },
          { key: 'y',       description: 'yank selection' },
          { key: 'c',       description: 'change selection' },
          { key: 'I',       description: 'insert at block start' },
          { key: 'A',       description: 'append at block end' },
          { key: 'Ctrl+a',  description: 'increment number' },
          { key: 'Ctrl+x',  description: 'decrement number' },
        ],
      },
    ],
  },
  {
    id: 'regex',
    label: 'REGEX',
    groups: [
      {
        label: 'VERY MAGIC',
        keys: [
          { key: '\\v',      description: 'very magic mode (ERE)' },
          { key: '(...)',     description: 'capture group' },
          { key: '\\1 \\2',  description: 'back-reference' },
          { key: '\\d{N}',   description: 'N digits' },
          { key: '\\w+',     description: 'one or more word chars' },
          { key: '.+',       description: 'one or more any char' },
        ],
      },
      {
        label: 'CHAR CLASSES',
        keys: [
          { key: '\\d', description: 'digit' },
          { key: '\\w', description: 'word character' },
          { key: '\\s', description: 'whitespace' },
          { key: '\\D', description: 'non-digit' },
          { key: '[a-z]', description: 'character range' },
        ],
      },
    ],
  },
];

export function getOrderedCategories(
  unlockedCategories: string[],
  activeMissionCategory: string | null
): CheatsheetCategory[] {
  const available = CHEATSHEET.filter(c => unlockedCategories.includes(c.id));
  if (!activeMissionCategory || !unlockedCategories.includes(activeMissionCategory)) {
    return available;
  }
  return [
    ...available.filter(c => c.id === activeMissionCategory),
    ...available.filter(c => c.id !== activeMissionCategory),
  ];
}
