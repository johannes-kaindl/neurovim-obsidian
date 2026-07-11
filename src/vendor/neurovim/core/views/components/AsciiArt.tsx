import React, { useMemo, useId } from 'react';

export type AsciiFilter = 'glitch' | 'scanlines' | 'chromatic' | 'corruption';

interface AsciiArtProps {
  art: string;
  filter?: AsciiFilter | null;
  fontSize?: number;
  fontFamily?: string;
  className?: string;
  maxWidth?: string | number;
  color?: string;
  ariaLabel?: string;
}

const MONO_STACK =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

export function AsciiArt({
  art,
  filter = null,
  fontSize = 10,
  fontFamily = MONO_STACK,
  className,
  maxWidth = '100%',
  color = 'currentColor',
  ariaLabel = 'ASCII art',
}: AsciiArtProps) {
  const uid = useId();

  const { lines, width, height, lineHeight } = useMemo(() => {
    const rawLines = art.replace(/\n+$/, '').split('\n');
    const maxCols = Math.max(1, ...rawLines.map((l) => l.length));
    const charWidth = fontSize * 0.6;
    const lh = fontSize * 1.2;
    return {
      lines: rawLines.map((l) => l.replace(/ /g, ' ')),
      width: maxCols * charWidth,
      height: rawLines.length * lh,
      lineHeight: lh,
    };
  }, [art, fontSize]);

  const filterId = filter ? `nv-filter-${filter}-${uid.replace(/:/g, '')}` : null;

  const textStyle = {
    fontFamily,
    fontSize: `${fontSize}px`,
    fontWeight: 400,
    whiteSpace: 'pre' as const,
    fontVariantLigatures: 'none' as const,
  };

  return (
    <div
      className={className}
      style={{
        maxWidth,
        width: '100%',
        background: 'transparent',
        border: 'none',
        padding: 0,
        margin: 0,
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMinYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label={ariaLabel}
      >
        {filterId && <AsciiFilterDefs id={filterId} kind={filter!} />}
        <g fill={color} filter={filterId ? `url(#${filterId})` : undefined}>
          {lines.map((line, i) => (
            <text
              key={i}
              x={0}
              y={(i + 1) * lineHeight - fontSize * 0.25}
              style={textStyle}
              fontFamily={fontFamily}
              fontSize={fontSize}
            >
              {line || ' '}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}

function AsciiFilterDefs({ id, kind }: { id: string; kind: AsciiFilter }) {
  switch (kind) {
    case 'glitch':
      return (
        <defs>
          <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
            <feDisplacementMap in="SourceGraphic" scale="2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      );
    case 'corruption':
      return (
        <defs>
          <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="turbulence" baseFrequency="0.03 0.6" numOctaves="2" seed="7" />
            <feDisplacementMap in="SourceGraphic" scale="5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      );
    case 'scanlines':
      return (
        <defs>
          <filter id={id} x="0" y="0" width="100%" height="100%">
            <feFlood floodColor="black" floodOpacity="0.25" result="shadow" />
            <feComposite in="shadow" in2="SourceAlpha" operator="in" result="scanShadow" />
            <feMerge>
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="scanShadow" />
            </feMerge>
          </filter>
        </defs>
      );
    case 'chromatic':
      return (
        <defs>
          <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0   0 0 0 0 0   0 0 0 0 0   0 0 0 1 0"
              result="r"
            />
            <feOffset in="r" dx="1" dy="0" result="rShift" />
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="0 0 0 0 0   0 0 0 0 0   0 0 1 0 0   0 0 0 1 0"
              result="b"
            />
            <feOffset in="b" dx="-1" dy="0" result="bShift" />
            <feBlend in="rShift" in2="bShift" mode="screen" result="rb" />
            <feBlend in="SourceGraphic" in2="rb" mode="screen" />
          </filter>
        </defs>
      );
  }
}
