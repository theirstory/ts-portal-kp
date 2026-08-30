import { BrowseView } from './Components/BrowseView';
import { SearchView } from './Components/SearchView';

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; theme?: string }>;
}) {
  const { q = '', theme = '' } = await searchParams;

  // A non-empty query turns the landing page into search results; clearing it
  // (the header drops ?q=) returns to browse.
  return q.trim() ? <SearchView query={q} category={theme} /> : <BrowseView />;
}
