import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Paper, AppConfig, SortState, FilterState, VenueConfig, LLMConfig, RatingValue, Comment } from './types';

const DEFAULT_VENUES: VenueConfig[] = [
  { id: 'neurips', shortName: 'NeurIPS', fullName: 'Neural Information Processing Systems', type: 'conference', dblpKey: 'conf/nips', enabled: false, color: '#8b5cf6' },
  { id: 'icml', shortName: 'ICML', fullName: 'Intl. Conference on Machine Learning', type: 'conference', dblpKey: 'conf/icml', enabled: false, color: '#3b82f6' },
  { id: 'iclr', shortName: 'ICLR', fullName: 'Intl. Conference on Learning Representations', type: 'conference', dblpKey: 'conf/iclr', enabled: false, color: '#06b6d4' },
  { id: 'cvpr', shortName: 'CVPR', fullName: 'Conference on Computer Vision and Pattern Recognition', type: 'conference', dblpKey: 'conf/cvpr', enabled: false, color: '#f59e0b' },
  { id: 'iccv', shortName: 'ICCV', fullName: 'Intl. Conference on Computer Vision', type: 'conference', dblpKey: 'conf/iccv', enabled: false, color: '#f97316' },
  { id: 'eccv', shortName: 'ECCV', fullName: 'European Conference on Computer Vision', type: 'conference', dblpKey: 'conf/eccv', enabled: false, color: '#fb923c' },
  { id: 'acl', shortName: 'ACL', fullName: 'Annual Meeting of the ACL', type: 'conference', dblpKey: 'conf/acl', enabled: false, color: '#10b981' },
  { id: 'emnlp', shortName: 'EMNLP', fullName: 'Empirical Methods in Natural Language Processing', type: 'conference', dblpKey: 'conf/emnlp', enabled: false, color: '#059669' },
  { id: 'naacl', shortName: 'NAACL', fullName: 'North American Chapter of the ACL', type: 'conference', dblpKey: 'conf/naacl-hlt', enabled: false, color: '#34d399' },
  { id: 'sigmod', shortName: 'SIGMOD', fullName: 'ACM SIGMOD Conference', type: 'conference', dblpKey: 'conf/sigmod', enabled: false, color: '#ef4444' },
  { id: 'vldb', shortName: 'VLDB', fullName: 'Very Large Data Bases', type: 'conference', dblpKey: 'conf/vldb', enabled: false, color: '#dc2626' },
  { id: 'osdi', shortName: 'OSDI', fullName: 'Operating Systems Design and Implementation', type: 'conference', dblpKey: 'conf/osdi', enabled: false, color: '#64748b' },
  { id: 'sosp', shortName: 'SOSP', fullName: 'Symposium on Operating Systems Principles', type: 'conference', dblpKey: 'conf/sosp', enabled: false, color: '#475569' },
  { id: 'sigir', shortName: 'SIGIR', fullName: 'ACM SIGIR Conference', type: 'conference', dblpKey: 'conf/sigir', enabled: false, color: '#ec4899' },
  { id: 'kdd', shortName: 'KDD', fullName: 'Knowledge Discovery and Data Mining', type: 'conference', dblpKey: 'conf/kdd', enabled: false, color: '#a855f7' },
  { id: 'www', shortName: 'WWW', fullName: 'The Web Conference', type: 'conference', dblpKey: 'conf/www', enabled: false, color: '#0ea5e9' },
  { id: 'aaai', shortName: 'AAAI', fullName: 'AAAI Conference on AI', type: 'conference', dblpKey: 'conf/aaai', enabled: false, color: '#14b8a6' },
  { id: 'ijcai', shortName: 'IJCAI', fullName: 'Intl. Joint Conference on AI', type: 'conference', dblpKey: 'conf/ijcai', enabled: false, color: '#6366f1' },
  { id: 'jmlr', shortName: 'JMLR', fullName: 'Journal of Machine Learning Research', type: 'journal', dblpKey: 'journals/jmlr', enabled: false, color: '#84cc16' },
  { id: 'tpami', shortName: 'TPAMI', fullName: 'IEEE Trans. on Pattern Analysis and Machine Intelligence', type: 'journal', dblpKey: 'journals/pami', enabled: false, color: '#22c55e' },
  { id: 'tkde', shortName: 'TKDE', fullName: 'IEEE Trans. on Knowledge and Data Engineering', type: 'journal', dblpKey: 'journals/tkde', enabled: false, color: '#4ade80' },
];

const DEFAULT_CONFIG: AppConfig = {
  venues: DEFAULT_VENUES,
  llm: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', enabled: false },
  papersPerVenue: 50,
};

const DEFAULT_FILTER: FilterState = { venues: [], minRating: 0, categories: [], search: '', years: [] };

interface PaperStore {
  papers: Paper[];
  config: AppConfig;
  sort: SortState;
  filter: FilterState;
  isSyncing: boolean;
  syncProgress: { done: number; total: number };
  syncErrors: Record<string, string>;

  upsertPapers: (papers: Paper[]) => void;
  updateRating: (id: string, rating: RatingValue) => void;
  updateComment: (id: string, comment: Comment) => void;
  updateCategory: (id: string, categories: string[]) => void;
  deletePaper: (id: string) => void;

  updateVenue: (id: string, updates: Partial<VenueConfig>) => void;
  addVenue: (venue: VenueConfig) => void;
  removeVenue: (id: string) => void;
  setLLMConfig: (llm: LLMConfig) => void;
  setPapersPerVenue: (n: number) => void;

  setSort: (sort: SortState) => void;
  setFilter: (filter: Partial<FilterState>) => void;
  resetFilter: () => void;

  setSyncing: (v: boolean) => void;
  setSyncProgress: (done: number, total: number) => void;
  setSyncError: (venueId: string, error: string) => void;
  clearSyncErrors: () => void;
}

const safeStorage = () =>
  typeof window !== 'undefined'
    ? localStorage
    : { getItem: () => null, setItem: () => {}, removeItem: () => {} };

export const usePaperStore = create<PaperStore>()(
  persist(
    (set) => ({
      papers: [],
      config: DEFAULT_CONFIG,
      sort: { field: 'year', order: 'desc' },
      filter: DEFAULT_FILTER,
      isSyncing: false,
      syncProgress: { done: 0, total: 0 },
      syncErrors: {},

      upsertPapers: (incoming) =>
        set((s) => {
          const map = new Map(s.papers.map((p) => [p.id, p]));
          for (const p of incoming) {
            const existing = map.get(p.id);
            if (existing) {
              map.set(p.id, {
                ...p,
                rating: existing.rating,
                comment: existing.comment,
                ai_category: existing.ai_category,
                ai_classified_at: existing.ai_classified_at,
              });
            } else {
              map.set(p.id, p);
            }
          }
          return { papers: Array.from(map.values()) };
        }),

      updateRating: (id, rating) =>
        set((s) => ({ papers: s.papers.map((p) => (p.id === id ? { ...p, rating } : p)) })),

      updateComment: (id, comment) =>
        set((s) => ({ papers: s.papers.map((p) => (p.id === id ? { ...p, comment } : p)) })),

      updateCategory: (id, categories) =>
        set((s) => ({
          papers: s.papers.map((p) =>
            p.id === id ? { ...p, ai_category: categories, ai_classified_at: new Date().toISOString() } : p
          ),
        })),

      deletePaper: (id) => set((s) => ({ papers: s.papers.filter((p) => p.id !== id) })),

      updateVenue: (id, updates) =>
        set((s) => ({
          config: {
            ...s.config,
            venues: s.config.venues.map((v) => (v.id === id ? { ...v, ...updates } : v)),
          },
        })),

      addVenue: (venue) =>
        set((s) => ({ config: { ...s.config, venues: [...s.config.venues, venue] } })),

      removeVenue: (id) =>
        set((s) => ({
          config: { ...s.config, venues: s.config.venues.filter((v) => v.id !== id) },
        })),

      setLLMConfig: (llm) => set((s) => ({ config: { ...s.config, llm } })),

      setPapersPerVenue: (n) => set((s) => ({ config: { ...s.config, papersPerVenue: n } })),

      setSort: (sort) => set({ sort }),

      setFilter: (update) => set((s) => ({ filter: { ...s.filter, ...update } })),

      resetFilter: () => set({ filter: DEFAULT_FILTER }),

      setSyncing: (isSyncing) => set({ isSyncing }),

      setSyncProgress: (done, total) => set({ syncProgress: { done, total } }),

      setSyncError: (venueId, error) =>
        set((s) => ({ syncErrors: { ...s.syncErrors, [venueId]: error } })),

      clearSyncErrors: () => set({ syncErrors: {} }),
    }),
    {
      name: 'paper-manager-v1',
      storage: createJSONStorage(safeStorage),
      partialize: (s) => ({ papers: s.papers, config: s.config, sort: s.sort }),
    }
  )
);
