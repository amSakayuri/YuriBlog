'use client';
import MiniSearch from 'minisearch';
import Link from 'next/link';
import { useMemo, useState } from 'react';
type Document = { id: string; type: string; title: string; text: string; url: string };
// Segment Han text into overlapping characters while retaining Latin words.
function tokenize(value: string) {
  return value.toLowerCase().match(/[\p{Script=Han}]|[\p{L}\p{N}_]+/gu) ?? [];
}
export function Search({ documents, language }: { documents: Document[]; language: string }) {
  const [query, setQuery] = useState('');
  const index = useMemo(() => {
    const search = new MiniSearch({
      fields: ['title', 'text'],
      storeFields: ['type', 'title', 'url'],
      tokenize,
      searchOptions: { boost: { title: 3 }, prefix: true, combineWith: 'AND' },
    });
    search.addAll(documents);
    return search;
  }, [documents]);
  const results = query.trim() ? index.search(query) : [];
  const en = language === 'en';
  return (
    <>
      <label className="search-label" htmlFor="public-search">
        {en ? 'Search published content' : '搜索已发布内容'}
      </label>
      <input
        id="public-search"
        className="search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={
          en ? 'Articles, novels, chapters, essays, projects…' : '文章、小说、章节、散文、项目…'
        }
        type="search"
      />
      <p className="muted" aria-live="polite">
        {query
          ? `${results.length} ${en ? 'results' : '条结果'}`
          : en
            ? 'Type to search.'
            : '输入关键词开始搜索。'}
      </p>
      <div className="content-list">
        {results.map((result) => (
          <Link href={result.url} key={result.id}>
            <span className="badge">{result.type}</span>
            <h2>{result.title}</h2>
          </Link>
        ))}
      </div>
    </>
  );
}
