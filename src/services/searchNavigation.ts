const SEARCH_PAGE_ORIGIN = 'https://search.yahoo.co.jp';
const SEARCH_PAGE_PATHNAME = '/realtime/search';

export const createSearchPageUrl = (keyword: string) => {
  const searchPageUrl = new URL(SEARCH_PAGE_PATHNAME, SEARCH_PAGE_ORIGIN);

  searchPageUrl.searchParams.set('p', keyword);

  return searchPageUrl.toString();
};

export const openSearchPage = (keyword: string) => {
  window.open(createSearchPageUrl(keyword), '_blank', 'noopener,noreferrer');
};
