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
const HISTORY_REORDER_DURATION_MS = 180;
const HISTORY_REORDER_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const DRAG_PREVIEW_ELEMENT_ID = 'history-drag-preview';

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

const findDragPreview = () =>
  document.querySelector<HTMLLIElement>(`#${DRAG_PREVIEW_ELEMENT_ID}`);

const getDraggingIdentifier = (container: ApplicationRootElement) =>
  container.dataset.draggingEntryId ?? '';

const getDraggingOffsetY = (container: ApplicationRootElement) =>
  Number(container.dataset.draggingOffsetY ?? '0');

const getDraggingItemHeight = (container: ApplicationRootElement) =>
  Number(container.dataset.draggingItemHeight ?? '0');

const getDraggingItemWidth = (container: ApplicationRootElement) =>
  Number(container.dataset.draggingItemWidth ?? '0');

const getDraggingItemLeft = (container: ApplicationRootElement) =>
  Number(container.dataset.draggingItemLeft ?? '0');

const getDraggingPointerY = (container: ApplicationRootElement) =>
  Number(container.dataset.draggingPointerY ?? '0');

const getLastReorderDirection = (container: ApplicationRootElement) =>
  container.dataset.lastReorderDirection ?? '';

const setDraggingIdentifier = (
  container: ApplicationRootElement,
  entryIdentifier: string,
) => {
  container.dataset.draggingEntryId = entryIdentifier;
};

const setDraggingMetrics = (
  container: ApplicationRootElement,
  offsetY: number,
  itemHeight: number,
  itemWidth: number,
  itemLeft: number,
  pointerY: number,
) => {
  container.dataset.draggingOffsetY = `${offsetY}`;
  container.dataset.draggingItemHeight = `${itemHeight}`;
  container.dataset.draggingItemWidth = `${itemWidth}`;
  container.dataset.draggingItemLeft = `${itemLeft}`;
  container.dataset.draggingPointerY = `${pointerY}`;
};

const setDraggingPointerY = (container: ApplicationRootElement, pointerY: number) => {
  container.dataset.draggingPointerY = `${pointerY}`;
};

const setLastReorderDirection = (container: ApplicationRootElement, direction: 'up' | 'down') => {
  container.dataset.lastReorderDirection = direction;
};

const clearDraggingIdentifier = (container: ApplicationRootElement) => {
  delete container.dataset.draggingEntryId;
  delete container.dataset.draggingOffsetY;
  delete container.dataset.draggingItemHeight;
  delete container.dataset.draggingItemWidth;
  delete container.dataset.draggingItemLeft;
  delete container.dataset.draggingPointerY;
  delete container.dataset.lastReorderDirection;
};

const createTransparentDragImage = () => {
  const canvas = document.createElement('canvas');

  canvas.width = 1;
  canvas.height = 1;

  return canvas;
};

const clearPreviewIdentifiers = (dragPreview: HTMLLIElement) => {
  dragPreview.removeAttribute('id');
  [...dragPreview.querySelectorAll<HTMLElement>('[id]')].forEach((element) => {
    element.removeAttribute('id');
  });
};

const createDragPreview = (historyItem: HTMLLIElement) => {
  const dragPreview = historyItem.cloneNode(true);

  if (!(dragPreview instanceof HTMLLIElement)) {
    return null;
  }

  clearPreviewIdentifiers(dragPreview);
  dragPreview.id = DRAG_PREVIEW_ELEMENT_ID;
  dragPreview.classList.add('history-list__item--drag-preview');

  return dragPreview;
};

const updateDragPreviewPosition = (
  container: ApplicationRootElement,
  pointerClientY: number,
) => {
  const dragPreview = findDragPreview();

  if (dragPreview === null) {
    return;
  }

  const draggingOffsetY = getDraggingOffsetY(container);
  const draggingItemLeft = getDraggingItemLeft(container);
  const draggingItemWidth = getDraggingItemWidth(container);
  const targetTop = pointerClientY - draggingOffsetY;

  dragPreview.style.left = `${draggingItemLeft}px`;
  dragPreview.style.top = `${targetTop}px`;
  dragPreview.style.width = `${draggingItemWidth}px`;
};

const mountDragPreview = (
  container: ApplicationRootElement,
  historyItem: HTMLLIElement,
  pointerClientY: number,
) => {
  const dragPreview = createDragPreview(historyItem);

  if (dragPreview === null) {
    return;
  }

  document.body.append(dragPreview);
  updateDragPreviewPosition(container, pointerClientY);
};

const removeDragPreview = () => {
  findDragPreview()?.remove();
};

const getHistoryItemPositions = (historyList: HTMLUListElement) =>
  new Map(
    [...historyList.querySelectorAll<HTMLLIElement>('.history-list__item')].map((item) => [
      item.id,
      item.getBoundingClientRect().top,
    ]),
  );

const clearHistoryItemReorderStyle = (historyItem: HTMLLIElement) => {
  historyItem.style.transition = '';
  historyItem.style.translate = '';
};

const animateHistoryListReorder = (
  historyList: HTMLUListElement,
  previousPositions: ReadonlyMap<string, number>,
) => {
  [...historyList.querySelectorAll<HTMLLIElement>('.history-list__item')].forEach((historyItem) => {
    if (historyItem.dataset.dragging === 'true') {
      return;
    }

    const previousTop = previousPositions.get(historyItem.id);

    if (previousTop === undefined) {
      return;
    }

    const currentTop = historyItem.getBoundingClientRect().top;
    const deltaY = previousTop - currentTop;

    if (deltaY === 0) {
      return;
    }

    clearHistoryItemReorderStyle(historyItem);
    historyItem.style.transition = 'none';
    historyItem.style.translate = `0 ${deltaY}px`;

    requestAnimationFrame(() => {
      historyItem.style.transition = `translate ${HISTORY_REORDER_DURATION_MS}ms ${HISTORY_REORDER_EASING}`;
      historyItem.style.translate = '';

      window.setTimeout(() => {
        clearHistoryItemReorderStyle(historyItem);
      }, HISTORY_REORDER_DURATION_MS);
    });
  });
};

const getPreviousHistoryItem = (historyItem: HTMLLIElement) => {
  const previousElement = historyItem.previousElementSibling;

  return previousElement instanceof HTMLLIElement ? previousElement : null;
};

const getNextHistoryItem = (historyItem: HTMLLIElement) => {
  const nextElement = historyItem.nextElementSibling;

  return nextElement instanceof HTMLLIElement ? nextElement : null;
};

const clampDragImageOffset = (offset: number, size: number) =>
  Math.max(0, Math.min(offset, size));

const getDragImageOffset = (event: DragEvent, historyItem: HTMLLIElement) => {
  const historyItemRect = historyItem.getBoundingClientRect();
  const offsetX = clampDragImageOffset(event.clientX - historyItemRect.left, historyItem.clientWidth);
  const offsetY = clampDragImageOffset(event.clientY - historyItemRect.top, historyItem.clientHeight);

  return {
    offsetX,
    offsetY,
  };
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
  pointerClientY: number,
) => {
  const historyList = findHistoryList(container);

  if (historyList === null || sourceIdentifier === '') {
    return;
  }

  const sourceItem = historyList.querySelector<HTMLLIElement>(
    `#${createHistoryItemId(sourceIdentifier)}`,
  );

  if (sourceItem === null) {
    return;
  }

  const draggingOffsetY = getDraggingOffsetY(container);
  const draggingItemHeight = getDraggingItemHeight(container);
  const previousPointerY = getDraggingPointerY(container);
  const lastReorderDirection = getLastReorderDirection(container);
  const pointerDirection =
    pointerClientY < previousPointerY ? 'up' : pointerClientY > previousPointerY ? 'down' : 'still';
  const targetTop = pointerClientY - draggingOffsetY;
  const targetBottom = targetTop + draggingItemHeight;
  const previousHistoryItem = getPreviousHistoryItem(sourceItem);
  const nextHistoryItem = getNextHistoryItem(sourceItem);
  const previousBottom = previousHistoryItem?.getBoundingClientRect().bottom;
  const nextTop = nextHistoryItem?.getBoundingClientRect().top;

  if (
    previousHistoryItem !== null &&
    previousBottom !== undefined &&
    targetTop <= previousBottom &&
    !(lastReorderDirection === 'down' && pointerDirection !== 'up')
  ) {
    const previousPositions = getHistoryItemPositions(historyList);

    historyList.insertBefore(sourceItem, previousHistoryItem);
    animateHistoryListReorder(historyList, previousPositions);
    setLastReorderDirection(container, 'up');
    setDraggingPointerY(container, pointerClientY);
    return;
  }

  if (
    nextHistoryItem !== null &&
    nextTop !== undefined &&
    targetBottom >= nextTop &&
    !(lastReorderDirection === 'up' && pointerDirection !== 'down')
  ) {
    const previousPositions = getHistoryItemPositions(historyList);

    historyList.insertBefore(sourceItem, nextHistoryItem.nextElementSibling);
    animateHistoryListReorder(historyList, previousPositions);
    setLastReorderDirection(container, 'down');
  }

  setDraggingPointerY(container, pointerClientY);
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
  const historyItem = findHistoryItem(container, entry.id);

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
    if (historyItem !== null) {
      const { offsetY } = getDragImageOffset(event, historyItem);
      const historyItemRect = historyItem.getBoundingClientRect();

      setDraggingMetrics(
        container,
        offsetY,
        historyItem.clientHeight,
        historyItem.clientWidth,
        historyItemRect.left,
        event.clientY,
      );
      mountDragPreview(container, historyItem, event.clientY);
      event.dataTransfer.setDragImage(
        createTransparentDragImage(),
        0,
        0,
      );
      historyItem.setAttribute('data-dragging', 'true');
    }
    setDraggingIdentifier(container, entry.id);
  });

  historyDragButton?.addEventListener('dragend', () => {
    if (historyItem !== null) {
      historyItem.removeAttribute('data-dragging');
    }

    removeDragPreview();
    clearDraggingIdentifier(container);
  });

  historyItem?.addEventListener('dragover', (event: DragEvent) => {
    if (event.dataTransfer === null) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    updateDragPreviewPosition(container, event.clientY);
    moveHistoryItemInDom(container, getDraggingIdentifier(container), event.clientY);
  });

  historyItem?.addEventListener('drop', (event: DragEvent) => {
    if (event.dataTransfer === null) {
      return;
    }

    event.preventDefault();
    updateDragPreviewPosition(container, event.clientY);
    moveHistoryItemInDom(container, event.dataTransfer.getData('text/plain'), event.clientY);
    reorderHistoryEntriesFromDom(container);
    removeDragPreview();
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
