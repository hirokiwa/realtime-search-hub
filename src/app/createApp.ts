import {
  appendSearchHistoryEntry,
  isKeywordEmpty,
  removeSearchHistoryEntry,
  sanitizeKeyword,
  sortSearchHistoryEntriesByIdentifiers,
} from '../domain/searchHistory.ts';
import { openSearchPage } from '../services/searchNavigation.ts';
import {
  loadSearchHistoryEntries,
  saveSearchHistoryEntries,
} from '../storage/searchHistoryStorage.ts';
import { createSearchPageUrl } from '../services/searchNavigation.ts';
import type { SearchHistoryEntry } from '../types/searchHistory.ts';

type ApplicationRootElement = HTMLElementTagNameMap['main'];

const findSearchForm = (container: ApplicationRootElement) =>
  container.querySelector<HTMLFormElement>('#search-form');

const findSearchInput = (container: ApplicationRootElement) =>
  container.querySelector<HTMLInputElement>('#search-keyword');

const findHistoryContainer = (container: ApplicationRootElement) =>
  container.querySelector<HTMLDivElement>('#search-history-content');

const findClearButton = (container: ApplicationRootElement) =>
  container.querySelector<HTMLButtonElement>('#clear-search-keyword-button');

const findHistoryList = (container: ApplicationRootElement) =>
  container.querySelector<HTMLUListElement>('#search-history-list');

const createHistoryItemId = (entryIdentifier: string) => `search-history-item-${entryIdentifier}`;

const createHistoryLinkId = (entryIdentifier: string) => `search-history-link-${entryIdentifier}`;

const createHistoryDeleteButtonId = (entryIdentifier: string) =>
  `search-history-delete-button-${entryIdentifier}`;

const createHistoryDragButtonId = (entryIdentifier: string) =>
  `search-history-drag-button-${entryIdentifier}`;

const findHistoryItem = (container: ApplicationRootElement, entryIdentifier: string) =>
  container.querySelector<HTMLLIElement>(`#${createHistoryItemId(entryIdentifier)}`);

const findHistoryLink = (container: ApplicationRootElement, entryIdentifier: string) =>
  container.querySelector<HTMLAnchorElement>(`#${createHistoryLinkId(entryIdentifier)}`);

const findHistoryDeleteButton = (container: ApplicationRootElement, entryIdentifier: string) =>
  container.querySelector<HTMLButtonElement>(`#${createHistoryDeleteButtonId(entryIdentifier)}`);

const findHistoryDragButton = (container: ApplicationRootElement, entryIdentifier: string) =>
  container.querySelector<HTMLButtonElement>(`#${createHistoryDragButtonId(entryIdentifier)}`);

const getDraggingIdentifier = (container: ApplicationRootElement) =>
  container.dataset.draggingEntryId ?? '';

const setDraggingIdentifier = (
  container: ApplicationRootElement,
  entryIdentifier: string,
) => {
  container.dataset.draggingEntryId = entryIdentifier;
};

const clearDraggingIdentifier = (container: ApplicationRootElement) => {
  delete container.dataset.draggingEntryId;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const createHistoryItemMarkup = (entry: SearchHistoryEntry) => `
  <li
    id="${createHistoryItemId(entry.id)}"
    class="history-list__item"
  >
    <button
      id="${createHistoryDragButtonId(entry.id)}"
      type="button"
      class="history-list__drag-button interactive-control"
      draggable="true"
      aria-label="「${escapeHtml(entry.keyword)}」の並び順を変更"
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
      id="${createHistoryLinkId(entry.id)}"
      class="history-list__link interactive-control"
      href="${createSearchPageUrl(entry.keyword)}"
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8" />
        <path d="M12 8V12L15 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span class="history-list__keyword">${escapeHtml(entry.keyword)}</span>
    </a>
    <button
      id="${createHistoryDeleteButtonId(entry.id)}"
      type="button"
      class="history-list__delete-button interactive-control"
      aria-label="「${escapeHtml(entry.keyword)}」を履歴から削除"
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
    <ul id="search-history-list" class="history-list" aria-label="検索履歴">
      ${entries.map((entry) => createHistoryItemMarkup(entry)).join('')}
    </ul>
  `;
};

const renderHistoryList = (
  container: HTMLDivElement,
  entries: readonly SearchHistoryEntry[],
) => {
  container.innerHTML = createHistoryListMarkup(entries);
};

const getOrderedEntryIdentifiersFromDom = (container: ApplicationRootElement) => {
  const historyList = findHistoryList(container);

  if (historyList === null) {
    return [];
  }

  return [...historyList.querySelectorAll<HTMLLIElement>('.history-list__item')].map((item) =>
    item.id.replace('search-history-item-', ''),
  );
};

const moveHistoryItemInDom = (
  container: ApplicationRootElement,
  sourceIdentifier: string,
  targetIdentifier: string,
  pointerClientY: number,
) => {
  const historyList = findHistoryList(container);

  if (historyList === null || sourceIdentifier === targetIdentifier) {
    return;
  }

  const sourceItem = historyList.querySelector<HTMLLIElement>(
    `#${createHistoryItemId(sourceIdentifier)}`,
  );
  const targetItem = historyList.querySelector<HTMLLIElement>(
    `#${createHistoryItemId(targetIdentifier)}`,
  );

  if (sourceItem === null || targetItem === null || sourceItem === targetItem) {
    return;
  }

  const targetRect = targetItem.getBoundingClientRect();
  const shouldInsertAfter = pointerClientY >= targetRect.top + targetRect.height / 2;
  const nextSibling = shouldInsertAfter ? targetItem.nextElementSibling : targetItem;
  const shouldKeepPosition =
    nextSibling === sourceItem || targetItem.previousElementSibling === sourceItem;

  if (!shouldKeepPosition) {
    historyList.insertBefore(sourceItem, nextSibling);
  }
};

const focusSearchInput = (container: ApplicationRootElement) => {
  findSearchInput(container)?.focus();
};

const setClearButtonDisabled = (container: ApplicationRootElement, isDisabled: boolean) => {
  const clearButton = findClearButton(container);

  if (clearButton !== null) {
    clearButton.disabled = isDisabled;
  }
};

const syncInputState = (container: ApplicationRootElement, keyword: string) => {
  const searchInput = findSearchInput(container);

  if (searchInput !== null) {
    searchInput.value = keyword;
  }

  setClearButtonDisabled(container, isKeywordEmpty(keyword));
};

const renderEntries = (container: ApplicationRootElement) => {
  const historyContainer = findHistoryContainer(container);

  if (historyContainer !== null) {
    renderHistoryList(historyContainer, loadSearchHistoryEntries());
  }
};

const saveEntries = (
  container: ApplicationRootElement,
  entries: ReturnType<typeof loadSearchHistoryEntries>,
) => {
  saveSearchHistoryEntries(entries);
  renderEntries(container);
  bindHistoryEvents(container);
};

const clearKeyword = (container: ApplicationRootElement) => {
  syncInputState(container, '');
  focusSearchInput(container);
};

const submitKeyword = (container: ApplicationRootElement) => {
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

const deleteHistoryEntry = (container: ApplicationRootElement, entryIdentifier: string) => {
  const nextEntries = removeSearchHistoryEntry(loadSearchHistoryEntries(), entryIdentifier);

  saveEntries(container, nextEntries);
};

const reorderHistoryEntriesFromDom = (container: ApplicationRootElement) => {
  const currentEntries = loadSearchHistoryEntries();
  const orderedIdentifiers = getOrderedEntryIdentifiersFromDom(container);
  const nextEntries = sortSearchHistoryEntriesByIdentifiers(currentEntries, orderedIdentifiers);

  saveEntries(container, nextEntries);
};

const searchHistoryEntry = (entryIdentifier: string) => {
  const targetEntry = loadSearchHistoryEntries().find((entry) => entry.id === entryIdentifier);

  if (targetEntry !== undefined) {
    openSearchPage(targetEntry.keyword);
  }
};

const bindSearchFormEvent = (container: ApplicationRootElement) => {
  const searchForm = findSearchForm(container);

  searchForm?.addEventListener('submit', (event: SubmitEvent) => {
    event.preventDefault();
    submitKeyword(container);
  });
};

const bindSearchInputEvent = (container: ApplicationRootElement) => {
  const searchInput = findSearchInput(container);

  searchInput?.addEventListener('input', (event: Event) => {
    const target = event.currentTarget;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    setClearButtonDisabled(container, isKeywordEmpty(target.value));
  });
};

const bindClearButtonEvent = (container: ApplicationRootElement) => {
  const clearButton = findClearButton(container);

  clearButton?.addEventListener('click', () => {
    clearKeyword(container);
  });
};

const bindHistoryEntryEvents = (container: ApplicationRootElement, entry: SearchHistoryEntry) => {
  const historyLink = findHistoryLink(container, entry.id);
  const historyDeleteButton = findHistoryDeleteButton(container, entry.id);
  const historyDragButton = findHistoryDragButton(container, entry.id);

  historyLink?.addEventListener('click', (event: MouseEvent) => {
    event.preventDefault();
    searchHistoryEntry(entry.id);
  });

  historyDeleteButton?.addEventListener('click', () => {
    deleteHistoryEntry(container, entry.id);
  });

  historyDragButton?.addEventListener('dragstart', (event: DragEvent) => {
    if (event.dataTransfer === null) {
      return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', entry.id);
    setDraggingIdentifier(container, entry.id);
    findHistoryItem(container, entry.id)?.setAttribute('data-dragging', 'true');
  });

  historyDragButton?.addEventListener('dragend', () => {
    findHistoryItem(container, entry.id)?.removeAttribute('data-dragging');
    clearDraggingIdentifier(container);
  });

  const historyItem = findHistoryItem(container, entry.id);

  historyItem?.addEventListener('dragover', (event: DragEvent) => {
    if (event.dataTransfer === null) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    moveHistoryItemInDom(
      container,
      getDraggingIdentifier(container),
      entry.id,
      event.clientY,
    );
  });

  historyItem?.addEventListener('drop', (event: DragEvent) => {
    if (event.dataTransfer === null) {
      return;
    }

    event.preventDefault();
    moveHistoryItemInDom(
      container,
      event.dataTransfer.getData('text/plain'),
      entry.id,
      event.clientY,
    );
    reorderHistoryEntriesFromDom(container);
    clearDraggingIdentifier(container);
  });
};

const bindHistoryEvents = (container: ApplicationRootElement) => {
  loadSearchHistoryEntries().forEach((entry) => {
    bindHistoryEntryEvents(container, entry);
  });
};

const bindEvents = (container: ApplicationRootElement) => {
  bindSearchFormEvent(container);
  bindSearchInputEvent(container);
  bindClearButtonEvent(container);
  bindHistoryEvents(container);
};

export const mountApplication = (container: ApplicationRootElement) => {
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
