import React from 'react';
import CinemaMarkdown from '../CinemaMarkdown';

export function CommunityRules({ rules = [], emptyText = 'No formal rules published.' }) {
  if (!rules.length) return <p className="cs-quiet">{emptyText}</p>;
  return (
    <ol className="cs-rules">
      {rules.map((rule, index) => (
        <li key={rule._id || rule.key || `${index}-${rule.title}`}>
          <strong>{rule.title}</strong>
          {rule.body && <p>{rule.body}</p>}
        </li>
      ))}
    </ol>
  );
}

/**
 * About text (rendered as safe text nodes by CinemaMarkdown — no HTML is
 * injected) followed by the rules. Shared by the community page and the
 * setup preview.
 */
export default function CommunityAbout({ community, headingLevel = 'h3', emptyText }) {
  const Heading = headingLevel;
  const rules = community.ruleItems || [];
  return (
    <div className="cs-about-block">
      <div className="cs-about">
        {community.description?.trim()
          ? <CinemaMarkdown content={community.description} />
          : <p className="cs-quiet">{emptyText || 'No description yet.'}</p>}
      </div>
      <Heading className="cs-about-heading">Rules</Heading>
      <CommunityRules rules={rules} />
    </div>
  );
}
