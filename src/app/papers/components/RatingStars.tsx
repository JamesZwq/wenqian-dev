'use client';

import { useState } from 'react';
import type { RatingValue } from '../types';

interface Props {
  value: RatingValue;
  onChange?: (v: RatingValue) => void;
  size?: 'sm' | 'md';
  readonly?: boolean;
}

export default function RatingStars({ value, onChange, size = 'md', readonly = false }: Props) {
  const [hover, setHover] = useState<number>(0);
  const dim = size === 'sm' ? 14 : 18;
  const active = hover || value;

  return (
    <div
      className="flex items-center gap-0.5"
      role={readonly ? undefined : 'group'}
      aria-label={readonly ? `Rating: ${value}/5` : 'Set rating'}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.((n === value ? 0 : n) as RatingValue)}
          onMouseEnter={() => !readonly && setHover(n)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={readonly ? 'cursor-default' : 'cursor-pointer transition-transform hover:scale-110'}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <svg width={dim} height={dim} viewBox="0 0 20 20">
            <polygon
              points="10,1 12.9,7 19.5,7.6 14.5,12 16.2,18.5 10,15 3.8,18.5 5.5,12 0.5,7.6 7.1,7"
              fill={n <= active ? '#f59e0b' : '#e5e7eb'}
              stroke={n <= active ? '#d97706' : '#d1d5db'}
              strokeWidth="0.5"
            />
          </svg>
        </button>
      ))}
      {!readonly && value > 0 && (
        <span className="ml-1 text-xs text-gray-400">{value}/5</span>
      )}
    </div>
  );
}
