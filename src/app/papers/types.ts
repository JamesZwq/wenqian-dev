export interface Author {
  name: string;
  pid?: string;
}

export interface Comment {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export type RatingValue = 0 | 1 | 2 | 3 | 4 | 5;

export interface Paper {
  id: string;
  dblpKey: string;
  title: string;
  authors: Author[];
  venue: string;
  venueType: 'conference' | 'journal';
  year: number;
  doi?: string;
  url?: string;
  ee?: string;
  pages?: string;
  rating: RatingValue;
  comment?: Comment;
  ai_category?: string[];
  ai_classified_at?: string;
  fetchedAt: string;
}

export interface VenueConfig {
  id: string;
  shortName: string;
  fullName?: string;
  type: 'conference' | 'journal';
  dblpKey: string;
  enabled: boolean;
  color: string;
  lastSynced?: string;
  yearFrom?: number;
}

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
}

export interface AppConfig {
  venues: VenueConfig[];
  llm: LLMConfig;
  papersPerVenue: number;
}

export type SortField = 'year' | 'rating' | 'venue' | 'title';
export type SortOrder = 'asc' | 'desc';

export interface SortState {
  field: SortField;
  order: SortOrder;
}

export interface FilterState {
  venues: string[];
  minRating: number;
  categories: string[];
  search: string;
  years: number[];
}
