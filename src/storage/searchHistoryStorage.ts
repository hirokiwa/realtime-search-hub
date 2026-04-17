import { SEARCH_HISTORY_STORAGE_KEY } from '../constants/storage.ts';
import type { SearchHistoryEntry } from '../types/searchHistory.ts';

const isSearchHistoryEntry = (value: unknown): value is SearchHistoryEntry => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return typeof record.id === 'string' && typeof record.keyword === 'string';
};

const parseSearchHistoryEntries = (value: string | null) => {
  if (value === null) {
    return [];
  }

  try {
    const parsedValue: unknown = JSON.parse(value);

    return Array.isArray(parsedValue) ? parsedValue.filter(isSearchHistoryEntry) : [];
  } catch {
    return [];
  }
};

export const loadSearchHistoryEntries = () =>
  parseSearchHistoryEntries(window.localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY));

export const saveSearchHistoryEntries = (entries: readonly SearchHistoryEntry[]) => {
  window.localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(entries));
};
