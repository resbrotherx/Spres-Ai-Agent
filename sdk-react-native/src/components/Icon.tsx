import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type BrainboxIconName =
  | 'newChat'
  | 'history'
  | 'close'
  | 'arrowUp'
  | 'stop'
  | 'copy'
  | 'check'
  | 'thumbsUp'
  | 'thumbsDown'
  | 'chevronDown'
  | 'chevronRight'
  | 'sparkles'
  | 'alert'
  | 'refresh'
  | 'message'
  | 'file'
  | 'search';

const PATHS: Record<BrainboxIconName, string[]> = {
  newChat: [
    'M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z'
  ],
  history: ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5', 'M12 7v5l4 2'],
  close: ['M18 6 6 18', 'm6 6 12 12'],
  arrowUp: ['m5 12 7-7 7 7', 'M12 19V5'],
  stop: [],
  copy: ['M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'],
  check: ['M20 6 9 17l-5-5'],
  thumbsUp: [
    'M7 10v12',
    'M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z'
  ],
  thumbsDown: [
    'M17 14V2',
    'M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z'
  ],
  chevronDown: ['m6 9 6 6 6-6'],
  chevronRight: ['m9 18 6-6-6-6'],
  sparkles: [
    'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z'
  ],
  alert: ['M12 8v4', 'M12 16h.01'],
  refresh: ['M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8', 'M21 3v5h-5'],
  message: ['M7.9 20A9 9 0 1 0 4 16.1L2 22Z'],
  file: ['M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z', 'M14 2v4a2 2 0 0 0 2 2h4', 'M16 13H8', 'M16 17H8'],
  search: ['m21 21-4.3-4.3']
};

export interface BrainboxIconProps {
  name: BrainboxIconName;
  size?: number;
  color: string;
  strokeWidth?: number;
  /** Fill the shape (used for selected 👍/👎). */
  filled?: boolean;
}

/** SF-Symbols-like line icons (24 viewBox, stroke 1.75, round caps/joins). */
export function BrainboxIcon({ name, size = 20, color, strokeWidth = 1.75, filled = false }: BrainboxIconProps) {
  const common = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none'
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'stop' && <Rect x="6" y="6" width="12" height="12" rx="2.5" fill={color} />}
      {name === 'copy' && <Rect x="8" y="8" width="14" height="14" rx="2" {...common} />}
      {name === 'alert' && <Circle cx="12" cy="12" r="10" {...common} />}
      {name === 'search' && <Circle cx="11" cy="11" r="8" {...common} />}
      {PATHS[name].map((d, i) => (
        <Path
          key={i}
          d={d}
          {...common}
          fill={filled && i === PATHS[name].length - 1 ? color : 'none'}
        />
      ))}
    </Svg>
  );
}
