import React from 'react';

/**
 * Lightweight Markdown renderer for Ask Expert replies.
 * Supports: paragraphs, **bold**, *italic*, bullets, numbered lists, ## headings.
 * No HTML injection — text nodes only.
 */

function inlineFormat(text, keyPrefix) {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let match;
  let idx = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<React.Fragment key={`${keyPrefix}-t-${idx++}`}>{text.slice(last, match.index)}</React.Fragment>);
    }
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(
        <strong
          key={`${keyPrefix}-b-${idx++}`}
          style={{ color: 'var(--vc-gold-light)', fontWeight: 700 }}
        >
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*')) {
      parts.push(
        <em key={`${keyPrefix}-i-${idx++}`} style={{ color: 'var(--vc-cream)' }}>
          {token.slice(1, -1)}
        </em>
      );
    } else {
      parts.push(
        <code
          key={`${keyPrefix}-c-${idx++}`}
          style={{
            fontFamily: 'var(--vc-font-mono)',
            fontSize: '0.85em',
            background: 'rgba(255,255,255,0.06)',
            padding: '0.1em 0.35em',
            borderRadius: 4,
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) {
    parts.push(<React.Fragment key={`${keyPrefix}-t-${idx++}`}>{text.slice(last)}</React.Fragment>);
  }
  return parts.length ? parts : text;
}

export default function CinemaMarkdown({ content }) {
  if (!content) return null;
  const lines = String(content).replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let listBuffer = null;

  const flushList = () => {
    if (!listBuffer) return;
    const Tag = listBuffer.type === 'ol' ? 'ol' : 'ul';
    blocks.push(
      <Tag
        key={`list-${blocks.length}`}
        style={{
          margin: '0.55rem 0 0.85rem',
          paddingLeft: '1.25rem',
          color: 'var(--vc-cream)',
        }}
      >
        {listBuffer.items.map((item, i) => (
          <li key={i} style={{ marginBottom: '0.35rem', lineHeight: 1.65 }}>
            {inlineFormat(item, `li-${blocks.length}-${i}`)}
          </li>
        ))}
      </Tag>
    );
    listBuffer = null;
  };

  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      return;
    }

    const bullet = trimmed.match(/^[-*•]\s+(.+)$/);
    const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (bullet || numbered) {
      const type = numbered ? 'ol' : 'ul';
      const text = (bullet || numbered)[1];
      if (!listBuffer || listBuffer.type !== type) {
        flushList();
        listBuffer = { type, items: [] };
      }
      listBuffer.items.push(text);
      return;
    }

    flushList();

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const Tag = level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5';
      blocks.push(
        <Tag
          key={`h-${lineIndex}`}
          style={{
            margin: '1rem 0 0.45rem',
            fontFamily: 'var(--vc-font-display)',
            fontSize: level === 1 ? '1.2rem' : '1.05rem',
            fontWeight: 700,
            color: 'var(--vc-cream)',
            letterSpacing: '-0.015em',
          }}
        >
          {inlineFormat(heading[2], `h-${lineIndex}`)}
        </Tag>
      );
      return;
    }

    blocks.push(
      <p
        key={`p-${lineIndex}`}
        style={{
          margin: '0 0 0.75rem',
          fontFamily: 'var(--vc-font-body)',
          lineHeight: 1.7,
          color: 'var(--vc-cream)',
        }}
      >
        {inlineFormat(trimmed, `p-${lineIndex}`)}
      </p>
    );
  });

  flushList();

  return <div className="cinema-md">{blocks}</div>;
}
