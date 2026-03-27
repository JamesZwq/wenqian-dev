'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Settings, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown,
  BookOpen, Sparkles, Loader2, CheckCircle, AlertCircle,
} from 'lucide-react';
import { usePaperStore } from './store';
import SearchFilterBar from './components/SearchFilterBar';
import PaperCard from './components/PaperCard';
import { syncAllVenues } from './utils/dblp';
import { classifyBatch } from './utils/llm';
import type { SortField, Paper } from './types';

export default function PapersPage() {
  const [hydrated, setHydrated] = useState(false);
  const [classifyingCount, setClassifyingCount] = useState(0);
  const [classifyTotal, setClassifyTotal] = useState(0);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const {
    papers, config, sort, filter,
    isSyncing, syncProgress, syncErrors,
    upsertPapers, updateCategory,
    setSort, setFilter,
    setSyncing, setSyncProgress, setSyncError, clearSyncErrors,
    updateVenue,
  } = usePaperStore();

  useEffect(() => { setHydrated(true); }, []);

  // ---------- Sort helpers ----------
  function handleSortField(field: SortField) {
    if (sort.field === field) {
      setSort({ field, order: sort.order === 'asc' ? 'desc' : 'asc' });
    } else {
      setSort({ field, order: field === 'year' ? 'desc' : 'asc' });
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sort.field !== field) return <ArrowUpDown size={12} className="opacity-40" />;
    return sort.order === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  }

  // ---------- Filtered + sorted papers ----------
  const displayPapers = useMemo(() => {
    let list = [...papers];

    // Guard: coerce year/rating to number in case localStorage restored them as strings.
    list = list.map((p) => ({
      ...p,
      year: Number(p.year),
      rating: (Number(p.rating) as Paper['rating']),
    }));

    if (filter.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.authors.some((a) => a.name.toLowerCase().includes(q)) ||
          p.venue.toLowerCase().includes(q)
      );
    }
    if (filter.venues.length > 0) {
      list = list.filter((p) => filter.venues.includes(p.venue));
    }
    if (filter.years.length > 0) {
      // Coerce stored years to number before comparing.
      const yearNums = filter.years.map(Number);
      list = list.filter((p) => yearNums.includes(Number(p.year)));
    }
    if (filter.minRating > 0) {
      list = list.filter((p) => Number(p.rating) >= filter.minRating);
    }
    if (filter.categories.length > 0) {
      list = list.filter((p) => p.ai_category?.some((c) => filter.categories.includes(c)));
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sort.field) {
        case 'year':   cmp = Number(a.year) - Number(b.year); break;
        case 'rating': cmp = Number(a.rating) - Number(b.rating); break;
        case 'venue':  cmp = a.venue.localeCompare(b.venue); break;
        case 'title':  cmp = a.title.localeCompare(b.title); break;
      }
      return sort.order === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [papers, sort, filter]);

  // ---------- Venue color map ----------
  const venueColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    config.venues.forEach((v) => { m[v.shortName] = v.color; });
    return m;
  }, [config.venues]);

  // ---------- Sync ----------
  const handleSync = useCallback(async () => {
    const enabled = config.venues.filter((v) => v.enabled);
    if (enabled.length === 0) {
      setToast({ msg: 'No venues enabled. Go to Configure to enable venues.', type: 'error' });
      setTimeout(() => setToast(null), 4000);
      return;
    }
    clearSyncErrors();
    setSyncing(true);

    const allPapers = await syncAllVenues(config.venues, config.papersPerVenue, {
      onVenueComplete: (id, count) => {
        updateVenue(id, { lastSynced: new Date().toISOString() });
        console.log(`Fetched ${count} papers for venue ${id}`);
      },
      onVenueError: (id, err) => setSyncError(id, err),
      onProgress: (done, total) => setSyncProgress(done, total),
    });

    upsertPapers(allPapers);
    setSyncing(false);

    const errCount = Object.keys(syncErrors).length;
    setToast({
      msg: `Synced ${allPapers.length} papers from ${enabled.length} venue(s)${errCount > 0 ? ` (${errCount} errors)` : ''}.`,
      type: errCount > 0 ? 'error' : 'success',
    });
    setTimeout(() => setToast(null), 5000);
  }, [config, clearSyncErrors, setSyncing, updateVenue, setSyncError, setSyncProgress, upsertPapers, syncErrors]);

  // ---------- Classify ----------
  const handleClassify = useCallback(async () => {
    const { llm } = config;
    if (!llm.enabled || !llm.apiKey) {
      setToast({ msg: 'LLM not configured. Go to Configure to set up AI classification.', type: 'error' });
      setTimeout(() => setToast(null), 4000);
      return;
    }
    const unclassified = papers.filter((p) => !p.ai_category || p.ai_category.length === 0);
    if (unclassified.length === 0) {
      setToast({ msg: 'All papers already classified.', type: 'success' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setClassifyTotal(unclassified.length);
    setClassifyingCount(0);

    await classifyBatch(unclassified, llm, {
      onProgress: (done, _total, paperId, categories) => {
        updateCategory(paperId, categories);
        setClassifyingCount(done);
      },
      onError: (paperId, err) => console.error('Classify error for', paperId, err),
    });

    setClassifyingCount(0);
    setClassifyTotal(0);
    setToast({ msg: `Classification complete for ${unclassified.length} papers.`, type: 'success' });
    setTimeout(() => setToast(null), 4000);
  }, [config, papers, updateCategory]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--pixel-bg)' }}>
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  const enabledCount = config.venues.filter((v) => v.enabled).length;
  const unclassifiedCount = papers.filter((p) => !p.ai_category || p.ai_category.length === 0).length;

  return (
    <div className="min-h-screen" style={{ background: 'var(--pixel-bg)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-30 border-b px-6 py-3 flex items-center gap-3"
        style={{
          background: 'rgba(250,251,254,0.85)',
          backdropFilter: 'blur(12px)',
          borderColor: 'var(--pixel-border)',
        }}
      >
        <BookOpen size={20} className="text-indigo-500" />
        <h1 className="font-bold text-lg" style={{ color: 'var(--pixel-text)' }}>
          Paper Manager
        </h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
          {papers.length} papers
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* Classify button */}
          {config.llm.enabled && unclassifiedCount > 0 && (
            <button
              onClick={handleClassify}
              disabled={classifyTotal > 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all bg-purple-50 text-purple-600 hover:bg-purple-100 disabled:opacity-60"
            >
              {classifyTotal > 0 ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {classifyingCount}/{classifyTotal}
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Classify {unclassifiedCount}
                </>
              )}
            </button>
          )}

          {/* Sync button */}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all text-white disabled:opacity-60"
            style={{ background: 'var(--pixel-accent)' }}
          >
            {isSyncing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {syncProgress.done}/{syncProgress.total}
              </>
            ) : (
              <>
                <RefreshCw size={14} />
                Sync Now {enabledCount > 0 && `(${enabledCount})`}
              </>
            )}
          </button>

          <Link
            href="/papers/configure"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border hover:bg-gray-50"
            style={{ borderColor: 'var(--pixel-border)', color: 'var(--pixel-text)' }}
          >
            <Settings size={14} />
            Configure
          </Link>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
            toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Body */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Search + Filter bar */}
        {papers.length > 0 && <SearchFilterBar papers={papers} />}

        {/* Sort + count row */}
        {papers.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs font-medium" style={{ color: 'var(--pixel-muted)' }}>
              Sort:
            </span>
            <div
              className="flex items-center rounded-xl border overflow-hidden text-xs"
              style={{ borderColor: 'var(--pixel-border)', background: 'var(--pixel-card-bg)' }}
            >
              {(
                [
                  { field: 'year' as SortField, label: 'Year' },
                  { field: 'rating' as SortField, label: 'Rating' },
                  { field: 'venue' as SortField, label: 'Venue' },
                  { field: 'title' as SortField, label: 'Title' },
                ] as { field: SortField; label: string }[]
              ).map(({ field, label }) => (
                <button
                  key={field}
                  onClick={() => handleSortField(field)}
                  className={`flex items-center gap-1 px-3 py-2 transition-colors font-medium ${
                    sort.field === field
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {label}
                  <SortIcon field={field} />
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs" style={{ color: 'var(--pixel-muted)' }}>
              {displayPapers.length} / {papers.length} papers
            </span>
          </div>
        )}

        {/* Main content */}
        <div>

          {/* Sync errors */}
          {Object.entries(syncErrors).length > 0 && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600">
              <strong>Sync errors:</strong>{' '}
              {Object.entries(syncErrors)
                .map(([id, err]) => `${id}: ${err}`)
                .join(' · ')}
            </div>
          )}

          {/* Paper list */}
          {papers.length === 0 ? (
            <EmptyState enabledCount={enabledCount} />
          ) : displayPapers.length === 0 ? (
            <div className="text-center py-16 text-sm" style={{ color: 'var(--pixel-muted)' }}>
              No papers match the current filters.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {displayPapers.map((paper) => (
                <PaperCard
                  key={paper.id}
                  paper={paper}
                  venueColor={venueColorMap[paper.venue] ?? '#6366f1'}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ enabledCount }: { enabledCount: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
        <BookOpen size={28} className="text-indigo-400" />
      </div>
      <div>
        <h2 className="font-semibold text-base mb-1" style={{ color: 'var(--pixel-text)' }}>
          No papers yet
        </h2>
        <p className="text-sm max-w-sm" style={{ color: 'var(--pixel-muted)' }}>
          {enabledCount === 0
            ? 'Start by going to Configure to enable venues you want to track, then click Sync Now.'
            : `${enabledCount} venue(s) enabled. Click Sync Now to fetch papers from DBLP.`}
        </p>
      </div>
      <Link
        href="/papers/configure"
        className="mt-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition"
        style={{ background: 'var(--pixel-accent)' }}
      >
        Go to Configure
      </Link>
    </div>
  );
}
