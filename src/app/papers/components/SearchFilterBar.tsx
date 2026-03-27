'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search, X, ChevronDown, Star, Tag, CalendarDays, BookMarked, SlidersHorizontal,
} from 'lucide-react';
import { usePaperStore } from '../store';
import type { Paper } from '../types';

interface Props {
  papers: Paper[];
}

/* ── small helpers ─────────────────────────────────────── */

function Chip({
  label, color, onRemove,
}: {
  label: string;
  color?: string;
  onRemove: () => void;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
      style={
        color
          ? { background: `${color}18`, borderColor: `${color}55`, color }
          : { background: 'var(--pixel-bg-alt)', borderColor: 'var(--pixel-border)', color: 'var(--pixel-muted)' }
      }
    >
      {label}
      <button
        onClick={onRemove}
        className="hover:opacity-60 transition ml-0.5"
        aria-label={`Remove ${label}`}
      >
        <X size={10} />
      </button>
    </span>
  );
}

function Dropdown({
  trigger,
  children,
  width = 220,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
          open
            ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
            : 'border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-[var(--pixel-muted)] hover:border-indigo-300 hover:text-indigo-600'
        }`}
      >
        {trigger}
        <ChevronDown
          size={11}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1.5 z-50 rounded-xl border shadow-xl overflow-hidden"
          style={{
            width,
            background: 'var(--pixel-card-bg)',
            borderColor: 'var(--pixel-border)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────── */

export default function SearchFilterBar({ papers }: Props) {
  const { filter, setFilter, resetFilter, config } = usePaperStore();

  /* derived options from actual papers */
  const venueOptions = useMemo(
    () => [...new Set(papers.map((p) => p.venue))].sort(),
    [papers]
  );
  // Coerce to Number to guard against localStorage restoring year as string.
  const yearOptions = useMemo(
    () => [...new Set(papers.map((p) => Number(p.year)))].filter(Boolean).sort((a, b) => b - a),
    [papers]
  );
  const categoryOptions = useMemo(() => {
    const s = new Set<string>();
    papers.forEach((p) => p.ai_category?.forEach((c) => s.add(c)));
    return [...s].sort();
  }, [papers]);

  const venueColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    config.venues.forEach((v) => { m[v.shortName] = v.color; });
    return m;
  }, [config.venues]);

  function toggleVenue(name: string) {
    setFilter({
      venues: filter.venues.includes(name)
        ? filter.venues.filter((v) => v !== name)
        : [...filter.venues, name],
    });
  }
  function toggleYear(y: number) {
    const yn = Number(y);
    const current = filter.years.map(Number);
    setFilter({
      years: current.includes(yn)
        ? current.filter((n) => n !== yn)
        : [...current, yn],
    });
  }
  function toggleCategory(c: string) {
    setFilter({
      categories: filter.categories.includes(c)
        ? filter.categories.filter((x) => x !== c)
        : [...filter.categories, c],
    });
  }

  const hasFilters =
    filter.search ||
    filter.venues.length ||
    filter.years.length ||
    filter.categories.length ||
    filter.minRating;

  /* active chip list */
  const chips: { key: string; label: string; color?: string; remove: () => void }[] = [
    ...filter.venues.map((v) => ({
      key: `v-${v}`,
      label: v,
      color: venueColorMap[v],
      remove: () => toggleVenue(v),
    })),
    ...filter.years.map((y) => ({
      key: `y-${y}`,
      label: String(y),
      remove: () => toggleYear(y),
    })),
    ...filter.categories.map((c) => ({
      key: `c-${c}`,
      label: c,
      remove: () => toggleCategory(c),
    })),
    ...(filter.minRating
      ? [{ key: 'r', label: `≥ ${filter.minRating}★`, remove: () => setFilter({ minRating: 0 }) }]
      : []),
  ];

  return (
    <div
      className="rounded-2xl border mb-5 overflow-hidden"
      style={{ borderColor: 'var(--pixel-border)', background: 'var(--pixel-card-bg)', backdropFilter: 'blur(8px)' }}
    >
      {/* ── Search row ── */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b"
        style={{ borderColor: 'var(--pixel-border)' }}
      >
        <Search size={15} className="text-indigo-400 shrink-0" />
        <input
          type="text"
          value={filter.search}
          onChange={(e) => setFilter({ search: e.target.value })}
          placeholder="Search title, author, venue…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 min-w-0"
          style={{ color: 'var(--pixel-text)' }}
        />
        {filter.search && (
          <button
            onClick={() => setFilter({ search: '' })}
            className="text-gray-300 hover:text-gray-500 transition shrink-0"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Filter row ── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        <SlidersHorizontal size={13} className="text-gray-400 shrink-0" />

        {/* Venue */}
        {venueOptions.length > 0 && (
          <Dropdown
            width={200}
            trigger={
              <>
                <BookMarked size={12} />
                Venue
                {filter.venues.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0 rounded-full bg-indigo-600 text-white text-[10px] leading-4">
                    {filter.venues.length}
                  </span>
                )}
              </>
            }
          >
            <div className="p-2 max-h-52 overflow-y-auto flex flex-col gap-0.5">
              {venueOptions.map((name) => {
                const checked = filter.venues.includes(name);
                const cnt = papers.filter((p) => p.venue === name).length;
                return (
                  <button
                    key={name}
                    onClick={() => toggleVenue(name)}
                    className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition ${
                      checked ? 'bg-indigo-50' : 'hover:bg-gray-50'
                    }`}
                    style={{ color: 'var(--pixel-text)' }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: venueColorMap[name] ?? '#999' }}
                    />
                    <span className="flex-1 font-medium">{name}</span>
                    <span className="text-gray-400">{cnt}</span>
                    {checked && (
                      <span className="w-3 h-3 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[8px]">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Dropdown>
        )}

        {/* Year */}
        {yearOptions.length > 0 && (
          <Dropdown
            width={180}
            trigger={
              <>
                <CalendarDays size={12} />
                Year
                {filter.years.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0 rounded-full bg-indigo-600 text-white text-[10px] leading-4">
                    {filter.years.length}
                  </span>
                )}
              </>
            }
          >
            <div className="p-2 flex flex-wrap gap-1.5">
              {yearOptions.map((y) => {
                const active = filter.years.includes(y);
                return (
                  <button
                    key={y}
                    onClick={() => toggleYear(y)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                    }`}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          </Dropdown>
        )}

        {/* Rating */}
        <Dropdown
          width={160}
          trigger={
            <>
              <Star size={12} />
              Rating
              {filter.minRating > 0 && (
                <span className="ml-0.5 px-1.5 py-0 rounded-full bg-amber-500 text-white text-[10px] leading-4">
                  {filter.minRating}+
                </span>
              )}
            </>
          }
        >
          <div className="p-3">
            <p className="text-xs text-gray-400 mb-2">Minimum rating</p>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setFilter({ minRating: n === filter.minRating ? 0 : n })}
                  className={`flex-1 py-1 rounded-lg text-xs font-medium transition ${
                    filter.minRating === n
                      ? 'bg-amber-400 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-amber-50'
                  }`}
                >
                  {n === 0 ? 'Any' : `${n}★`}
                </button>
              ))}
            </div>
          </div>
        </Dropdown>

        {/* AI Category */}
        {categoryOptions.length > 0 && (
          <Dropdown
            width={230}
            trigger={
              <>
                <Tag size={12} />
                Category
                {filter.categories.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0 rounded-full bg-purple-600 text-white text-[10px] leading-4">
                    {filter.categories.length}
                  </span>
                )}
              </>
            }
          >
            <div className="p-2 max-h-52 overflow-y-auto flex flex-col gap-0.5">
              {categoryOptions.map((cat) => {
                const checked = filter.categories.includes(cat);
                const cnt = papers.filter((p) => p.ai_category?.includes(cat)).length;
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition ${
                      checked ? 'bg-purple-50' : 'hover:bg-gray-50'
                    }`}
                    style={{ color: 'var(--pixel-text)' }}
                  >
                    <span className="flex-1">{cat}</span>
                    <span className="text-gray-400">{cnt}</span>
                    {checked && (
                      <span className="w-3 h-3 rounded-full bg-purple-600 flex items-center justify-center text-white text-[8px]">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Dropdown>
        )}

        {/* Clear all */}
        {hasFilters ? (
          <button
            onClick={resetFilter}
            className="ml-auto flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition font-medium"
          >
            <X size={12} />
            Clear all
          </button>
        ) : (
          <span className="ml-auto text-xs" style={{ color: 'var(--pixel-muted)' }}>
            No filters active
          </span>
        )}
      </div>

      {/* ── Active chips ── */}
      {chips.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5 px-4 py-2 border-t"
          style={{ borderColor: 'var(--pixel-border)', background: 'var(--pixel-bg-alt)' }}
        >
          {chips.map((c) => (
            <Chip key={c.key} label={c.label} color={c.color} onRemove={c.remove} />
          ))}
        </div>
      )}
    </div>
  );
}
