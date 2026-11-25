import React from 'react';
import { communityCategoryLabel, summarizeCommunityText } from '../../../data/communityOptions.js';
import CommunityCard from './CommunityCard';
import CommunityHeader from './CommunityHeader';
import CommunityAbout from './CommunityAbout';

/**
 * Live preview for the setup flow. Nothing is saved: it renders the current
 * form values through the same card and page components used for real
 * communities.
 */
export function buildPreviewCommunity(form, images = {}) {
  const rules = (form.rules || []).filter(rule => rule.title.trim());
  return {
    _id: 'preview',
    name: form.name.trim(),
    slug: form.slug,
    tagline: form.tagline.trim(),
    description: form.description,
    summary: form.tagline.trim() || summarizeCommunityText(form.description),
    category: form.category || 'other',
    categoryLabel: communityCategoryLabel(form.category || 'other'),
    topics: form.topics || [],
    ruleItems: rules,
    privacy: form.privacy || 'public',
    avatar: images.avatar || '',
    coverImage: images.cover || '',
    memberCount: 1,
    discussionCount: 0,
  };
}

export default function CommunityPreview({ community, full = false }) {
  return (
    <div className={`cs-preview-stack${full ? ' is-full' : ''}`} aria-label="Preview">
      <section>
        <p className="cs-preview-label">In discovery</p>
        <div className="cs-preview-card">
          <CommunityCard community={community} preview />
        </div>
      </section>
      <section>
        <p className="cs-preview-label">Community page</p>
        <div className="cs-preview-page">
          <CommunityHeader community={community} compact headingLevel="h3" />
          <div className="cs-preview-page-body">
            <p className="cs-preview-url">/community/{community.slug || 'your-address'}</p>
            <CommunityAbout
              community={community}
              headingLevel="h4"
              emptyText="Your About text will appear here."
            />
          </div>
        </div>
      </section>
    </div>
  );
}
