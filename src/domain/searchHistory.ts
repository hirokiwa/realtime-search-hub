import type { SearchHistoryEntry } from '../types/searchHistory.ts';

const createSearchHistoryIdentifier = () => {
  const timestamp = Date.now().toString(36);
  const randomValue = crypto.randomUUID();

  return `${timestamp}-${randomValue}`;
};

export const createSearchHistoryEntry = (keyword: string): SearchHistoryEntry => ({
  id: createSearchHistoryIdentifier(),
  keyword,
});

export const sanitizeKeyword = (keyword: string) => keyword.trim();

export const isKeywordEmpty = (keyword: string) => sanitizeKeyword(keyword).length === 0;

const isSameKeyword = (sourceKeyword: string, targetKeyword: string) =>
  sanitizeKeyword(sourceKeyword) === sanitizeKeyword(targetKeyword);

const hasSearchHistoryEntry = (
  entries: readonly SearchHistoryEntry[],
  keyword: string,
) => entries.some((entry) => isSameKeyword(entry.keyword, keyword));

export const appendSearchHistoryEntry = (
  entries: readonly SearchHistoryEntry[],
  keyword: string,
) =>
  hasSearchHistoryEntry(entries, keyword)
    ? [...entries]
    : [...entries, createSearchHistoryEntry(sanitizeKeyword(keyword))];

export const removeSearchHistoryEntry = (
  entries: readonly SearchHistoryEntry[],
  entryIdentifier: string,
) => entries.filter((entry) => entry.id !== entryIdentifier);

const findSearchHistoryEntryIndex = (
  entries: readonly SearchHistoryEntry[],
  entryIdentifier: string,
) => entries.findIndex((entry) => entry.id === entryIdentifier);

export const moveSearchHistoryEntry = (
  entries: readonly SearchHistoryEntry[],
  sourceIdentifier: string,
  targetIdentifier: string,
) => {
  const sourceIndex = findSearchHistoryEntryIndex(entries, sourceIdentifier);
  const targetIndex = findSearchHistoryEntryIndex(entries, targetIdentifier);

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return [...entries];
  }

  const sourceEntry = entries[sourceIndex];
  const entriesWithoutSource = entries.filter((entry) => entry.id !== sourceIdentifier);
  const insertIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;

  return [
    ...entriesWithoutSource.slice(0, insertIndex),
    sourceEntry,
    ...entriesWithoutSource.slice(insertIndex),
  ];
};

export const sortSearchHistoryEntriesByIdentifiers = (
  entries: readonly SearchHistoryEntry[],
  orderedIdentifiers: readonly string[],
) => {
  const entryMap = new Map(entries.map((entry) => [entry.id, entry]));

  return orderedIdentifiers.flatMap((identifier) => {
    const targetEntry = entryMap.get(identifier);

    return targetEntry === undefined ? [] : [targetEntry];
  });
};
