'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Trash2, Eye, EyeOff, Save,
  Cpu, RefreshCw, BookOpen, Layers, CheckCircle, AlertCircle,
  Search, Plus, Loader2, ExternalLink,
} from 'lucide-react';
import { usePaperStore } from '../store';
import type { VenueConfig, LLMConfig } from '../types';

const PRESET_COLORS = [
  '#8b5cf6', '#3b82f6', '#06b6d4', '#f59e0b', '#10b981',
  '#ef4444', '#f97316', '#64748b', '#ec4899', '#0ea5e9',
  '#a855f7', '#14b8a6', '#6366f1', '#84cc16', '#22c55e',
];

function pickColor(index: number) {
  return PRESET_COLORS[index % PRESET_COLORS.length];
}

interface DblpVenueResult {
  name: string;
  acronym: string;
  type: 'conference' | 'journal';
  dblpKey: string;
  url: string;
}

export default function ConfigurePage() {
  const [hydrated, setHydrated] = useState(false);
  const {
    config, updateVenue, addVenue, removeVenue,
    setLLMConfig, setPapersPerVenue,
    isSyncing, syncErrors, clearSyncErrors,
    setSyncing, setSyncProgress, setSyncError, updateVenue: markVenueSynced,
    upsertPapers,
  } = usePaperStore();

  const [llmForm, setLlmForm] = useState<LLMConfig>({ ...config.llm });
  const [llmSaved, setLlmSaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // DBLP venue search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DblpVenueResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    setHydrated(true);
    setLlmForm({ ...config.llm });
  }, [config.llm]);

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  // ---------- DBLP venue search ----------
  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    setSearchError('');
    try {
      const res = await fetch(`/api/papers/venues?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSearchResults(data.venues ?? []);
    } catch (err) {
      setSearchError(String(err));
      setSearchResults([]);
    }
    setSearching(false);
  }, []);

  function handleSearchInput(q: string) {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 400);
  }

  function handleAddFromSearch(result: DblpVenueResult) {
    if (config.venues.find((v) => v.dblpKey === result.dblpKey)) return;
    const colorIdx = config.venues.length;
    const venue: VenueConfig = {
      id: crypto.randomUUID(),
      shortName: result.acronym || result.name.split(/\s+/).slice(0, 2).join(' '),
      fullName: result.name,
      type: result.type,
      dblpKey: result.dblpKey,
      enabled: true,
      color: pickColor(colorIdx),
      yearFrom: new Date().getFullYear() - 2,
    };
    addVenue(venue);
    showToast(`Added "${venue.shortName}" (${result.dblpKey})`);
  }

  // ---------- LLM save ----------
  function handleSaveLLM() {
    setLLMConfig(llmForm);
    setLlmSaved(true);
    showToast('LLM configuration saved.');
    setTimeout(() => setLlmSaved(false), 2000);
  }

  // ---------- Sync single venue ----------
  async function handleSyncVenue(venue: VenueConfig) {
    clearSyncErrors();
    setSyncing(true);
    setSyncProgress(0, 1);
    try {
      const { fetchVenuePapers } = await import('../utils/dblp');
      const papers = await fetchVenuePapers(venue, config.papersPerVenue, venue.yearFrom);
      upsertPapers(papers);
      markVenueSynced(venue.id, { lastSynced: new Date().toISOString() });
      showToast(`Fetched ${papers.length} papers from ${venue.shortName}`);
    } catch (err) {
      setSyncError(venue.id, String(err));
      showToast(`Sync failed: ${err}`, 'error');
    }
    setSyncing(false);
    setSyncProgress(0, 0);
  }

  if (!hydrated) return null;

  const conferences = config.venues.filter((v) => v.type === 'conference');
  const journals = config.venues.filter((v) => v.type === 'journal');

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
        <Link
          href="/papers"
          className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-indigo-600"
          style={{ color: 'var(--pixel-muted)' }}
        >
          <ArrowLeft size={16} />
          Back
        </Link>
        <span className="text-gray-300">|</span>
        <h1 className="font-bold text-lg" style={{ color: 'var(--pixel-text)' }}>
          Configure
        </h1>
      </header>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-8">
        {/* ---- Venues Section ---- */}
        <Section
          icon={<BookOpen size={18} className="text-indigo-500" />}
          title="Tracked Venues"
        >
          {/* DBLP venue search */}
          <div
            className="mb-5 rounded-xl border overflow-hidden"
            style={{ borderColor: 'var(--pixel-border)' }}
          >
            {/* Search input */}
            <div
              className="flex items-center gap-2 px-4 py-3 border-b"
              style={{ borderColor: 'var(--pixel-border)', background: 'var(--pixel-bg)' }}
            >
              <Search size={15} className="text-indigo-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                placeholder={'Search DBLP for a venue — e.g. "SIGMOD", "NeurIPS", "VLDB"…'}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                style={{ color: 'var(--pixel-text)' }}
              />
              {searching && <Loader2 size={14} className="animate-spin text-indigo-400 shrink-0" />}
            </div>

            {/* Results */}
            {searchError && (
              <p className="px-4 py-3 text-xs text-red-500">{searchError}</p>
            )}
            {!searching && searchQuery.length >= 2 && searchResults.length === 0 && !searchError && (
              <p className="px-4 py-3 text-xs" style={{ color: 'var(--pixel-muted)' }}>
                No venues found on DBLP for &ldquo;{searchQuery}&rdquo;.
              </p>
            )}
            {searchResults.length > 0 && (
              <ul className="divide-y" style={{ borderColor: 'var(--pixel-border)' }}>
                {searchResults.map((r) => {
                  const alreadyAdded = config.venues.some((v) => v.dblpKey === r.dblpKey);
                  return (
                    <li
                      key={r.dblpKey}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-indigo-50/40 transition-colors"
                      style={{ background: 'var(--pixel-bg)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-sm font-semibold truncate"
                            style={{ color: 'var(--pixel-text)' }}
                          >
                            {r.name}
                          </span>
                          {r.acronym && r.acronym !== r.name && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono shrink-0">
                              {r.acronym}
                            </span>
                          )}
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                              r.type === 'journal'
                                ? 'bg-emerald-50 text-emerald-600'
                                : 'bg-indigo-50 text-indigo-600'
                            }`}
                          >
                            {r.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-xs" style={{ color: 'var(--pixel-muted)' }}>
                            {r.dblpKey}
                          </code>
                          {r.url && (
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-400 hover:text-indigo-600 transition"
                            >
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddFromSearch(r)}
                        disabled={alreadyAdded}
                        className={`shrink-0 flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                          alreadyAdded
                            ? 'bg-gray-100 text-gray-400 cursor-default'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        {alreadyAdded ? (
                          <><CheckCircle size={12} /> Added</>
                        ) : (
                          <><Plus size={12} /> Add</>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Hint when empty */}
            {searchQuery.length < 2 && (
              <p className="px-4 py-3 text-xs" style={{ color: 'var(--pixel-muted)' }}>
                DBLP often has <strong>multiple streams</strong> per venue (e.g. main track, companion volume, new journal format).
                Search to see all of them and add whichever you need.
              </p>
            )}
          </div>

          {/* Papers per venue setting */}
          <div className="flex items-center gap-3 mb-4 p-3 rounded-xl border" style={{ borderColor: 'var(--pixel-border)', background: 'var(--pixel-card-bg)' }}>
            <span className="text-sm" style={{ color: 'var(--pixel-text)' }}>Papers per venue per sync:</span>
            <input
              type="number"
              min={10} max={500} step={10}
              value={config.papersPerVenue}
              onChange={(e) => setPapersPerVenue(parseInt(e.target.value) || 50)}
              className="w-20 text-center text-sm rounded-lg border px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-400"
              style={{ borderColor: 'var(--pixel-border)', background: 'var(--pixel-bg)', color: 'var(--pixel-text)' }}
            />
          </div>

          {/* Venue groups */}
          {[
            { label: 'Conferences', items: conferences },
            { label: 'Journals', items: journals },
          ].map(({ label, items }) => (
            <div key={label} className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Layers size={14} className="text-gray-400" />
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--pixel-muted)' }}>
                  {label}
                </span>
                <span className="text-xs text-gray-400">
                  ({items.filter((v) => v.enabled).length}/{items.length} enabled)
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((venue) => (
                  <VenueRow
                    key={venue.id}
                    venue={venue}
                    error={syncErrors[venue.id]}
                    isSyncing={isSyncing}
                    onToggle={() => updateVenue(venue.id, { enabled: !venue.enabled })}
                    onSync={() => handleSyncVenue(venue)}
                    onYearFromChange={(y) => updateVenue(venue.id, { yearFrom: y })}
                    onDelete={() => removeVenue(venue.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </Section>

        {/* ---- LLM Section ---- */}
        <Section
          icon={<Cpu size={18} className="text-purple-500" />}
          title="AI Auto-Classification"
        >
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="API Base URL">
              <input
                value={llmForm.baseUrl}
                onChange={(e) => setLlmForm({ ...llmForm, baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
                className={inputCls}
              />
            </Field>
            <Field label="Model">
              <input
                value={llmForm.model}
                onChange={(e) => setLlmForm({ ...llmForm, model: e.target.value })}
                placeholder="gpt-4o-mini"
                className={inputCls}
              />
            </Field>
            <Field label="API Key" className="col-span-2">
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={llmForm.apiKey}
                  onChange={(e) => setLlmForm({ ...llmForm, apiKey: e.target.value })}
                  placeholder="sk-..."
                  className={inputCls + ' pr-9'}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={llmForm.enabled}
                onChange={(e) => setLlmForm({ ...llmForm, enabled: e.target.checked })}
                className="accent-purple-600 w-4 h-4"
              />
              <span className="text-sm font-medium" style={{ color: 'var(--pixel-text)' }}>
                Enable AI classification
              </span>
            </label>
            <button
              onClick={handleSaveLLM}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition"
              style={{ background: llmSaved ? '#10b981' : 'var(--pixel-accent-2)' }}
            >
              {llmSaved ? <CheckCircle size={14} /> : <Save size={14} />}
              {llmSaved ? 'Saved!' : 'Save Configuration'}
            </button>
          </div>

          <p className="mt-3 text-xs" style={{ color: 'var(--pixel-muted)' }}>
            Supports any OpenAI-compatible API (OpenAI, Anthropic via proxy, Deepseek, local Ollama, etc.).
            API keys are stored locally in your browser and never sent to any server other than the configured endpoint.
          </p>
        </Section>
      </div>
    </div>
  );
}

// ---------- Sub-components ----------

function Section({
  icon, title, action, children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border p-6"
      style={{ background: 'var(--pixel-card-bg)', borderColor: 'var(--pixel-border)', backdropFilter: 'blur(8px)' }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="font-semibold text-base" style={{ color: 'var(--pixel-text)' }}>
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({
  label, children, className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--pixel-muted)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full text-sm rounded-lg border px-3 py-2 outline-none transition focus:ring-2 focus:ring-indigo-400 bg-transparent';

function VenueRow({
  venue, error, isSyncing, onToggle, onSync, onYearFromChange, onDelete,
}: {
  venue: VenueConfig;
  error?: string;
  isSyncing: boolean;
  onToggle: () => void;
  onSync: () => void;
  onYearFromChange: (year: number | undefined) => void;
  onDelete: () => void;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [editYear, setEditYear] = useState(false);
  const [yearVal, setYearVal] = useState(venue.yearFrom?.toString() ?? '');

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
        venue.enabled ? '' : 'opacity-50'
      }`}
      style={{ borderColor: error ? '#fca5a5' : 'var(--pixel-border)', background: 'var(--pixel-bg)' }}
    >
      {/* Toggle switch */}
      <button
        type="button"
        role="switch"
        aria-checked={venue.enabled}
        onClick={onToggle}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          venue.enabled ? 'bg-indigo-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
            venue.enabled ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>

      {/* Color dot + name */}
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: venue.color }} />
      <span
        className="text-sm font-semibold w-20 shrink-0"
        style={{ color: 'var(--pixel-text)' }}
      >
        {venue.shortName}
      </span>

      <span className="text-xs flex-1 truncate" style={{ color: 'var(--pixel-muted)' }}>
        {venue.fullName ?? venue.dblpKey}
      </span>

      {/* Year from */}
      <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--pixel-muted)' }}>
        <span>from</span>
        {editYear ? (
          <input
            autoFocus
            type="number"
            value={yearVal}
            onChange={(e) => setYearVal(e.target.value)}
            onBlur={() => {
              const y = parseInt(yearVal);
              onYearFromChange(y > 1900 ? y : undefined);
              setEditYear(false);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="w-16 border rounded px-1 py-0.5 text-xs text-center outline-none"
            style={{ borderColor: 'var(--pixel-border)', background: 'var(--pixel-bg)', color: 'var(--pixel-text)' }}
          />
        ) : (
          <button
            onClick={() => setEditYear(true)}
            className="hover:text-indigo-500 underline underline-offset-2 transition"
          >
            {venue.yearFrom ?? 'all years'}
          </button>
        )}
      </div>

      {venue.lastSynced && (
        <span className="text-xs hidden lg:block" style={{ color: 'var(--pixel-muted)' }}>
          {new Date(venue.lastSynced).toLocaleDateString()}
        </span>
      )}
      {error && (
        <span className="text-xs text-red-500" title={error}>
          <AlertCircle size={12} />
        </span>
      )}

      <button
        onClick={onSync}
        disabled={isSyncing}
        className="text-xs px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 flex items-center gap-1 transition"
      >
        <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
        Sync
      </button>

      <button
        onClick={() => {
          if (!confirmDel) { setConfirmDel(true); return; }
          onDelete();
        }}
        onBlur={() => setConfirmDel(false)}
        className={`text-xs px-2 py-1 rounded-lg transition ${
          confirmDel ? 'bg-red-100 text-red-600' : 'text-gray-300 hover:text-red-400 hover:bg-gray-100'
        }`}
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}
