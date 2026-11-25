import React, { useEffect, useState } from 'react';
import CommunityCard from './CommunityCard';
import { fetchCommunityList } from '../../api/community';

const PAGE_SIZE = 9;
const MAX_VISIBLE = 40;

/**
 * Discovery browse. Collapsed by default — Featured stays the hero rail.
 * Opens only when the person taps More (or starts searching / filtering).
 */
export default function CommunityBrowser({ onJoin, joiningId, refreshKey = 0, onCreate }) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [topic, setTopic] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState({ categories: [], topics: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [metaReady, setMetaReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  // Lightweight total/facets for the collapsed teaser.
  useEffect(() => {
    const controller = new AbortController();
    fetchCommunityList({ page: 1, limit: 1 }, controller.signal)
      .then(data => {
        if (data.facets) setFacets(data.facets);
        setTotal(data.total || 0);
        setMetaReady(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setMetaReady(true);
      });
    return () => controller.abort();
  }, [refreshKey]);

  useEffect(() => {
    if (!expanded) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetchCommunityList(
      { q: search, category, topic, page: 1, limit: PAGE_SIZE * page },
      controller.signal
    )
      .then(data => {
        if (data.facets) setFacets(data.facets);
        setRows(data.communities || []);
        setTotal(data.total || 0);
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        setError(err.response?.data?.error || 'Could not load communities.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [expanded, search, category, topic, page, refreshKey]);

  const pick = (setter, value) => {
    setter(current => (current === value ? '' : value));
    setPage(1);
  };
  const clear = () => {
    setQuery('');
    setSearch('');
    setCategory('');
    setTopic('');
    setPage(1);
  };
  const openBrowse = () => setExpanded(true);
  const filtered = Boolean(search || category || topic);

  return (
    <section className="cs-section" id="browse-communities">
      <div className="cs-comm-wrap">
        <div className="cs-section-head">
          <div>
            <h2>Find Your People</h2>
            <p>
              {metaReady && total > 0
                ? `${total} public communities beyond Featured.`
                : 'Search every public community, or narrow by category and topic.'}
            </p>
          </div>
          <div className="cs-comm-actions">
            {!expanded ? (
              <button type="button" className="cs-btn cs-btn-primary" onClick={openBrowse}>
                More
              </button>
            ) : (
              <button
                type="button"
                className="cs-btn cs-btn-ghost"
                onClick={() => {
                  setExpanded(false);
                  clear();
                }}
              >
                Hide
              </button>
            )}
            <button type="button" className="cs-btn cs-btn-ghost" onClick={onCreate}>
              Found a Society
            </button>
          </div>
        </div>

        {!expanded && (
          <div className="cs-browse-teaser">
            <p className="cs-quiet cs-browse-hint">
              Featured is above. Tap More to search the full directory — including older societies.
            </p>
            <button type="button" className="cs-btn cs-btn-ghost" onClick={openBrowse}>
              Browse all communities
            </button>
          </div>
        )}

        {expanded && (
          <>
            <div className="cs-browse-controls">
              <label className="cs-browse-search">
                <span className="cs-visually-hidden">Search communities</span>
                <input
                  type="search"
                  value={query}
                  maxLength={60}
                  placeholder="Search by name, tagline or topic"
                  onChange={event => setQuery(event.target.value)}
                />
              </label>

              {facets.categories?.length > 0 && (
                <div className="cs-feed-filters" role="group" aria-label="Filter by category">
                  <button
                    type="button"
                    className={`cs-filter${category ? '' : ' is-active'}`}
                    aria-pressed={!category}
                    onClick={() => { setCategory(''); setPage(1); }}
                  >
                    All
                  </button>
                  {facets.categories.map(item => (
                    <button
                      key={item.key}
                      type="button"
                      className={`cs-filter${category === item.key ? ' is-active' : ''}`}
                      aria-pressed={category === item.key}
                      onClick={() => pick(setCategory, item.key)}
                    >
                      {item.label} <span className="cs-filter-count">{item.count}</span>
                    </button>
                  ))}
                </div>
              )}

              {facets.topics?.length > 0 && (
                <div className="cs-topic-row" role="group" aria-label="Filter by topic">
                  {facets.topics.map(item => (
                    <button
                      key={item.key}
                      type="button"
                      className={`cs-topic cs-topic-btn${topic === item.key ? ' is-active' : ''}`}
                      aria-pressed={topic === item.key}
                      onClick={() => pick(setTopic, item.key)}
                    >
                      {item.key}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="cs-error" role="alert">{error}</p>}

            {!error && !loading && !rows.length && (
              <div className="cs-empty">
                {filtered ? 'No communities match that search.' : 'No communities yet.'}
                <div className="cs-comm-actions" style={{ justifyContent: 'center', marginTop: '1rem' }}>
                  {filtered && (
                    <button type="button" className="cs-btn cs-btn-ghost" onClick={clear}>Clear filters</button>
                  )}
                  <button type="button" className="cs-btn cs-btn-primary" onClick={onCreate}>Found a Society</button>
                </div>
              </div>
            )}

            {rows.length > 0 && (
              <>
                <p className="cs-browse-count" aria-live="polite">
                  {total} {total === 1 ? 'community' : 'communities'}
                  {filtered && (
                    <button type="button" className="cs-link-btn" onClick={clear}>Clear filters</button>
                  )}
                </p>
                <div className="cs-browse-grid" aria-busy={loading}>
                  {rows.map(community => (
                    <CommunityCard
                      key={community._id}
                      community={community}
                      onJoin={onJoin}
                      joiningId={joiningId}
                    />
                  ))}
                </div>
              </>
            )}

            {loading && !rows.length && (
              <div className="cs-browse-grid">
                {[0, 1, 2].map(item => <div key={item} className="cs-skeleton" style={{ minHeight: 220 }} />)}
              </div>
            )}

            {rows.length < total && (
              <div className="cs-comm-actions" style={{ justifyContent: 'center', marginTop: '1.25rem' }}>
                {PAGE_SIZE * page < MAX_VISIBLE ? (
                  <button
                    type="button"
                    className="cs-btn cs-btn-ghost"
                    disabled={loading}
                    onClick={() => setPage(current => current + 1)}
                  >
                    {loading ? 'Loading…' : 'Show more'}
                  </button>
                ) : (
                  <p className="cs-quiet">Showing the first {rows.length}. Search or filter to narrow it down.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
