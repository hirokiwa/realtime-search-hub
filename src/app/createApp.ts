import {
  appendSearchHistoryEntry,
  isKeywordEmpty,
  moveSearchHistoryEntry,
  removeSearchHistoryEntry,
  sanitizeKeyword,
} from '../domain/searchHistory.ts';
import { openSearchPage } from '../services/searchNavigation.ts';
import {
  loadSearchHistoryEntries,
  saveSearchHistoryEntries,
} from '../storage/searchHistoryStorage.ts';
import { createSearchPageUrl } from '../services/searchNavigation.ts';
import type { SearchHistoryEntry } from '../types/searchHistory.ts';

const findSearchForm = (container: HTMLElement) =>
  container.querySelector<HTMLFormElement>('.search-form');

const findSearchInput = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>('#search-keyword');

const findHistoryContainer = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-history-content]');

const findClearButton = (container: HTMLElement) =>
  container.querySelector<HTMLButtonElement>('[data-action="clear-input"]');

const findSearchHistoryLink = (element: HTMLElement) =>
  element.closest<HTMLElement>('[data-action="search-history"]');

const findHistoryDeleteButton = (element: HTMLElement) =>
  element.closest<HTMLElement>('[data-action="delete-history"]');

const findDragButton = (element: HTMLElement) =>
  element.closest<HTMLElement>('[data-action="drag"]');

const extractEntryIdentifier = (element: HTMLElement | null) => element?.dataset.entryId ?? '';

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const createHistoryItemMarkup = (entry: SearchHistoryEntry) => `
  <li class="history-list__item" data-entry-id="${entry.id}">
    <button
      type="button"
      class="history-list__drag-button interactive-control"
      draggable="true"
      aria-label="「${escapeHtml(entry.keyword)}」の並び順を変更"
      data-entry-id="${entry.id}"
      data-action="drag"
    >
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="9" cy="7" r="1.4" fill="currentColor" />
        <circle cx="15" cy="7" r="1.4" fill="currentColor" />
        <circle cx="9" cy="12" r="1.4" fill="currentColor" />
        <circle cx="15" cy="12" r="1.4" fill="currentColor" />
        <circle cx="9" cy="17" r="1.4" fill="currentColor" />
        <circle cx="15" cy="17" r="1.4" fill="currentColor" />
      </svg>
    </button>
    <a
      class="history-list__link interactive-control"
      href="${createSearchPageUrl(entry.keyword)}"
      target="_blank"
      rel="noopener noreferrer"
      data-entry-id="${entry.id}"
      data-action="search-history"
    >
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8" />
        <path d="M12 8V12L15 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span class="history-list__keyword">${escapeHtml(entry.keyword)}</span>
    </a>
    <button
      type="button"
      class="history-list__delete-button interactive-control"
      aria-label="「${escapeHtml(entry.keyword)}」を履歴から削除"
      data-entry-id="${entry.id}"
      data-action="delete-history"
    >
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 7L17 17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        <path d="M17 7L7 17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
    </button>
  </li>
`;

const createHistoryListMarkup = (entries: readonly SearchHistoryEntry[]) => {
  if (entries.length === 0) {
    return `
      <p class="history-panel__empty">検索履歴はまだありません。</p>
    `;
  }

  return `
    <ul class="history-list" aria-label="検索履歴">
      ${entries.map((entry) => createHistoryItemMarkup(entry)).join('')}
    </ul>
  `;
};

const renderHistoryList = (
  container: HTMLElement,
  entries: readonly SearchHistoryEntry[],
) => {
  container.innerHTML = createHistoryListMarkup(entries);
};

const focusSearchInput = (container: HTMLElement) => {
  findSearchInput(container)?.focus();
};

const setClearButtonDisabled = (container: HTMLElement, isDisabled: boolean) => {
  const clearButton = findClearButton(container);

  if (clearButton !== null) {
    clearButton.disabled = isDisabled;
  }
};

const syncInputState = (container: HTMLElement, keyword: string) => {
  const searchInput = findSearchInput(container);

  if (searchInput !== null) {
    searchInput.value = keyword;
  }

  setClearButtonDisabled(container, isKeywordEmpty(keyword));
};

const renderEntries = (container: HTMLElement) => {
  const historyContainer = findHistoryContainer(container);

  if (historyContainer !== null) {
    renderHistoryList(historyContainer, loadSearchHistoryEntries());
  }
};

const saveEntries = (container: HTMLElement, entries: ReturnType<typeof loadSearchHistoryEntries>) => {
  saveSearchHistoryEntries(entries);
  renderEntries(container);
};

const clearKeyword = (container: HTMLElement) => {
  syncInputState(container, '');
  focusSearchInput(container);
};

const submitKeyword = (container: HTMLElement) => {
  const searchInput = findSearchInput(container);

  if (searchInput === null) {
    return;
  }

  const sanitizedKeyword = sanitizeKeyword(searchInput.value);

  if (isKeywordEmpty(sanitizedKeyword)) {
    return;
  }

  const nextEntries = appendSearchHistoryEntry(loadSearchHistoryEntries(), sanitizedKeyword);

  saveEntries(container, nextEntries);
  openSearchPage(sanitizedKeyword);
  clearKeyword(container);
};

const deleteHistoryEntry = (container: HTMLElement, entryIdentifier: string) => {
  const nextEntries = removeSearchHistoryEntry(loadSearchHistoryEntries(), entryIdentifier);

  saveEntries(container, nextEntries);
};

const reorderHistoryEntries = (
  container: HTMLElement,
  sourceIdentifier: string,
  targetIdentifier: string,
) => {
  const nextEntries = moveSearchHistoryEntry(
    loadSearchHistoryEntries(),
    sourceIdentifier,
    targetIdentifier,
  );

  saveEntries(container, nextEntries);
};

const searchHistoryEntry = (entryIdentifier: string) => {
  const targetEntry = loadSearchHistoryEntries().find((entry) => entry.id === entryIdentifier);

  if (targetEntry !== undefined) {
    openSearchPage(targetEntry.keyword);
  }
};

const bindSubmitEvent = (container: HTMLElement) => {
  container.addEventListener('submit', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLFormElement) || !target.classList.contains('search-form')) {
      return;
    }

    event.preventDefault();
    submitKeyword(container);
  });
};

const bindInputEvent = (container: HTMLElement) => {
  container.addEventListener('input', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLInputElement) || target.id !== 'search-keyword') {
      return;
    }

    setClearButtonDisabled(container, isKeywordEmpty(target.value));
  });
};

const bindClickEvent = (container: HTMLElement) => {
  container.addEventListener('click', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const historyLink = findSearchHistoryLink(target);
    const historyDeleteButton = findHistoryDeleteButton(target);
    const clearButton = target.closest<HTMLElement>('[data-action="clear-input"]');

    if (historyLink !== null) {
      event.preventDefault();
      searchHistoryEntry(extractEntryIdentifier(historyLink));
    }

    if (historyDeleteButton !== null) {
      deleteHistoryEntry(container, extractEntryIdentifier(historyDeleteButton));
    }

    if (clearButton !== null) {
      clearKeyword(container);
    }
  });
};

const bindDragEvent = (container: HTMLElement) => {
  container.addEventListener('dragstart', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const dragButton = findDragButton(target);

    if (dragButton === null || event.dataTransfer === null) {
      return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', extractEntryIdentifier(dragButton));
  });

  container.addEventListener('dragover', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const historyListItem = target.closest<HTMLElement>('.history-list__item');

    if (historyListItem === null || event.dataTransfer === null) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  });

  container.addEventListener('drop', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement) || event.dataTransfer === null) {
      return;
    }

    const historyListItem = target.closest<HTMLElement>('.history-list__item');

    if (historyListItem === null) {
      return;
    }

    event.preventDefault();

    reorderHistoryEntries(
      container,
      event.dataTransfer.getData('text/plain'),
      extractEntryIdentifier(historyListItem),
    );
  });
};

const bindEvents = (container: HTMLElement) => {
  bindSubmitEvent(container);
  bindInputEvent(container);
  bindClickEvent(container);
  bindDragEvent(container);
};

export const mountApplication = (container: HTMLElement) => {
  const searchForm = findSearchForm(container);
  const searchInput = findSearchInput(container);
  const historyContainer = findHistoryContainer(container);

  if (searchForm === null || searchInput === null || historyContainer === null) {
    return;
  }

  renderEntries(container);
  syncInputState(container, '');
  bindEvents(container);
  focusSearchInput(container);
};
