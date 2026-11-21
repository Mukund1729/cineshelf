import React from 'react';

export default function CommunityStats({ stats, loading }) {
  const items = [
    { key: 'totalCommunities', label: 'Communities' },
    { key: 'totalMembers', label: 'Members' },
    { key: 'totalDiscussions', label: 'Discussions' },
    { key: 'activeCommunities', label: 'Active' },
  ];

  return (
    <section className="cs-section">
      <div className="cs-comm-wrap">
        <div className="cs-stats" aria-live="polite">
          {items.map(item => (
            <div key={item.key} className="cs-stat">
              {loading ? (
                <div className="cs-skeleton" style={{ height: 36, width: '55%', marginBottom: 8 }} />
              ) : (
                <strong>{Number(stats?.[item.key] || 0).toLocaleString()}</strong>
              )}
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
