'use client';

import { useMemo } from 'react';
import { X } from 'lucide-react';
import { usePaperStore } from '../store';
import type { Paper } from '../types';

interface Props {
  papers: Paper[];
}

const ALL_CATEGORIES = [
  'Large Language Models', 'Computer Vision', 'Natural Language Processing',
  'Reinforcement Learning', 'Graph Neural Networks', 'Generative Models',
  'Multimodal Learning', 'Optimization & Theory', 'Federated Learning',
  'Robotics', 'Speech & Audio', 'Data Management', 'Systems & Infrastructure',
  'Fairness & Ethics', 'Recommendation Systems', 'Knowledge Graphs',
  'Security & Privacy', 'Embodied AI',
];

export default function FilterPanel({ papers }: Props) {
  const { filter, setFilter, resetFilter, config } = usePaperStore();

  const activeVenues = useMemo(
    () => [...new Set(papers.map((p) => p.venue))].sort(),
    [papers]
  );

  const activeYears = useMemo(
    () => [...new Set(papers.map((p) => p.year))].sort((a, b) => b - a),
    [papers]
  );

  const activeCategories = useMemo(() => {
    const cats = new Set<string>();
    papers.forEach((p) => p.ai_category?.forEach((c) => cats.add(c)));
    return ALL_CATEGORIES.filter((c) => cats.has(c));
  }, [papers]);

  function toggleVenue(name: string) {
    setFilter({
      venues: filter.venues.includes(name)
        ? filter.venues.filter((v) => v !== name)
        : [...filter.venues, name],
    });
  }

  function toggleYear(year: number) {
    setFilter({
      years: filter.years.includes(year)
        ? filter.years.filter((y) => y !== year)
        : [...filter.years, year],
    });
  }

  function toggleCategory(cat: string) {
    setFilter({
      categories: filter.categories.includes(cat)
        ? filter.categories.filter((c) => c !== cat)
        : [...filter.categories, cat],
    });
  }

  const hasActiveFilters =
    filter.venues.length > 0 ||
    filter.years.length > 0 ||
    filter.categories.length > 0 ||
    filter.minRating > 0 ||
    filter.search.length > 0;

  const venueColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    config.venues.forEach((v) => { m[v.shortName] = v.color; });
    return m;
  }, [config.venues]);

  return (
    <aside className="w-56 shrink-0 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: 'var(--pixel-text)' }}>
          Filters
        </span>
        {hasActiveFilters && (
          <button
            onClick={resetFilter}
            className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition"
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Min Rating */}
      <FilterSection title="Min Rating">
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setFilter({ minRating: n === filter.minRating ? 0 : n })}
              className={`w-7 h-7 text-xs rounded-lg font-medium transition-colors ${
                filter.minRating === n
                  ? 'bg-amber-400 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-amber-100'
              }`}
            >
              {n === 0 ? 'Any' : `${n}★`}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Venues */}
      {activeVenues.length > 0 && (
        <FilterSection title="Venue">
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {activeVenues.map((name) => {
              const count = papers.filter((p) => p.venue === name).length;
              const checked = filter.venues.includes(name);
              return (
                <label
                  key={name}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleVenue(name)}
                    className="accent-indigo-600 w-3 h-3"
                  />
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: venueColorMap[name] ?? '#999' }}
                  />
                  <span
                    className="text-xs flex-1 group-hover:text-indigo-600 transition"
                    style={{ color: 'var(--pixel-text)' }}
                  >
                    {name}
                  </span>
                  <span className="text-xs text-gray-400">{count}</span>
                </label>
              );
            })}
          </div>
        </FilterSection>
      )}

      {/* Years */}
      {activeYears.length > 0 && (
        <FilterSection title="Year">
          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
            {activeYears.map((year) => (
              <button
                key={year}
                onClick={() => toggleYear(year)}
                className={`px-2 py-0.5 text-xs rounded-lg transition-colors font-medium ${
                  filter.years.includes(year)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-indigo-50'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </FilterSection>
      )}

      {/* AI Categories */}
      {activeCategories.length > 0 && (
        <FilterSection title="AI Category">
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {activeCategories.map((cat) => {
              const count = papers.filter((p) => p.ai_category?.includes(cat)).length;
              const checked = filter.categories.includes(cat);
              return (
                <label key={cat} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCategory(cat)}
                    className="accent-indigo-600 w-3 h-3"
                  />
                  <span
                    className="text-xs flex-1 group-hover:text-indigo-600 transition"
                    style={{ color: 'var(--pixel-text)' }}
                  >
                    {cat}
                  </span>
                  <span className="text-xs text-gray-400">{count}</span>
                </label>
              );
            })}
          </div>
        </FilterSection>
      )}
    </aside>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--pixel-muted)' }}>
        {title}
      </p>
      {children}
    </div>
  );
}
