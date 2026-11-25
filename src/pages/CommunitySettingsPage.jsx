import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import {
  AboutEditor,
  CategoryPicker,
  ConfirmDialog,
  Counter,
  Field,
  ImagePicker,
  PrivacyPicker,
  RulesEditor,
  TopicsInput,
  newRule,
} from '../components/community/CommunitySetupFields';
import CommunityCard from '../components/community/CommunityCard';
import {
  fetchCommunityDetail,
  fetchCommunityMembers,
  removeCommunityImage,
  updateCommunity,
  updateCommunityMember,
  uploadCommunityImage,
} from '../api/community';
import { apiUrl } from '../api/config';
import { COMMUNITY_LIMITS as LIMITS, summarizeCommunityText } from '../../data/communityOptions.js';
import './community.css';

const OWNER_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'rules', label: 'Rules & Privacy' },
];
const STAFF_TABS = [
  { key: 'requests', label: 'Requests' },
  { key: 'members', label: 'Members' },
];

function toDraft(community) {
  return {
    name: community.name || '',
    tagline: community.tagline || '',
    description: community.description || '',
    category: community.category || 'other',
    topics: community.topics || [],
    rules: (community.ruleItems || []).map(rule => newRule(rule)),
    privacy: community.privacy || 'public',
  };
}

function cleanRules(rules) {
  return rules
    .filter(rule => rule.title.trim())
    .map(rule => ({ title: rule.title.trim(), body: rule.body.trim() }));
}

// Only the fields that actually changed are sent to the server.
function diffDraft(draft, saved) {
  const changes = {};
  for (const field of ['name', 'tagline', 'description']) {
    if (draft[field].trim() !== saved[field].trim()) changes[field] = draft[field].trim();
  }
  if (draft.category !== saved.category) changes.category = draft.category;
  if (draft.privacy !== saved.privacy) changes.privacy = draft.privacy;
  if (JSON.stringify(draft.topics) !== JSON.stringify(saved.topics)) changes.topics = draft.topics;
  if (JSON.stringify(cleanRules(draft.rules)) !== JSON.stringify(cleanRules(saved.rules))) {
    changes.rules = cleanRules(draft.rules);
  }
  return changes;
}

function validateDraft(draft) {
  const errors = {};
  const name = draft.name.trim();
  if (name.length < LIMITS.nameMin || name.length > LIMITS.nameMax) {
    errors.name = `Name must be ${LIMITS.nameMin}–${LIMITS.nameMax} characters.`;
  }
  if (draft.tagline.trim().length > LIMITS.taglineMax) {
    errors.tagline = `Tagline can be up to ${LIMITS.taglineMax} characters.`;
  }
  const about = draft.description.trim().length;
  if (about < LIMITS.descriptionMin || about > LIMITS.descriptionMax) {
    errors.description = `About must be ${LIMITS.descriptionMin}–${LIMITS.descriptionMax} characters.`;
  }
  if (draft.rules.some(rule => (rule.title.trim() || rule.body.trim()) && rule.title.trim().length < LIMITS.ruleTitleMin)) {
    errors.rules = `Every rule needs a short title (at least ${LIMITS.ruleTitleMin} characters).`;
  }
  return errors;
}

const FIELD_TAB = { name: 'details', tagline: 'details', description: 'details', category: 'details', topics: 'details', rules: 'rules', privacy: 'rules' };

function userAvatar(user) {
  if (!user?.avatar) return '';
  return user.avatar.startsWith('/') ? apiUrl(user.avatar) : user.avatar;
}

function MemberRow({ item, children }) {
  const user = item.user || {};
  const src = userAvatar(user);
  return (
    <li className="cs-manage-row">
      <Link className="cs-manage-user" to={`/people/${user._id}`}>
        {src
          ? <img className="cs-avatar" src={src} alt="" />
          : <span className="cs-avatar cs-avatar-fallback">{(user.username || user.name || 'U')[0]}</span>}
        <span>
          <strong>{user.name || user.username || 'Member'}</strong>
          <span className="cs-post-sub">
            @{user.username}
            {item.status === 'active' ? ` · ${item.role}` : ''}
            {item.joinedAt ? ` · ${item.status === 'pending' ? 'requested' : 'since'} ${new Date(item.joinedAt).toLocaleDateString()}` : ''}
          </span>
        </span>
      </Link>
      <div className="cs-manage-actions">{children}</div>
    </li>
  );
}

export default function CommunitySettingsPage() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState({ loading: true, error: '', community: null, viewer: null });
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [imageBusy, setImageBusy] = useState('');
  const [imageError, setImageError] = useState({});
  const [lists, setLists] = useState({ active: [], pending: [], banned: [], loading: true, error: '' });
  const [busyMember, setBusyMember] = useState('');
  const [confirm, setConfirm] = useState(null);

  const community = state.community;
  const isOwner = Boolean(state.viewer?.isOwner);
  const canManage = Boolean(state.viewer?.canManage);
  const tabs = useMemo(() => (isOwner ? [...OWNER_TABS, ...STAFF_TABS] : STAFF_TABS), [isOwner]);
  const requestedTab = searchParams.get('tab');
  const tab = tabs.some(item => item.key === requestedTab) ? requestedTab : tabs[0].key;

  const load = useCallback(async () => {
    setState(current => ({ ...current, loading: true, error: '' }));
    try {
      const data = await fetchCommunityDetail(slug);
      setState({ loading: false, error: '', community: data.community, viewer: data.viewer || null });
      const next = toDraft(data.community);
      setDraft(next);
      setSaved(next);
    } catch (err) {
      setState({
        loading: false,
        error: err.response?.status === 403
          ? 'Only the owner and moderators can manage this community.'
          : (err.response?.data?.error || 'Community not found.'),
        community: null,
        viewer: null,
      });
    }
  }, [slug]);

  const loadMembers = useCallback(async () => {
    setLists(current => ({ ...current, loading: true, error: '' }));
    try {
      const [active, pending, banned] = await Promise.all([
        fetchCommunityMembers(slug, 'active'),
        fetchCommunityMembers(slug, 'pending'),
        fetchCommunityMembers(slug, 'banned'),
      ]);
      setLists({
        active: active.members || [],
        pending: pending.members || [],
        banned: banned.members || [],
        loading: false,
        error: '',
      });
    } catch (err) {
      setLists(current => ({
        ...current,
        loading: false,
        error: err.response?.data?.error || 'Could not load members.',
      }));
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (canManage) loadMembers(); }, [canManage, loadMembers]);

  const changes = useMemo(() => (draft && saved ? diffDraft(draft, saved) : {}), [draft, saved]);
  const dirty = Object.keys(changes).length > 0;

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = event => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const setTab = key => setSearchParams(current => {
    const next = new URLSearchParams(current);
    next.set('tab', key);
    return next;
  }, { replace: true });

  const setField = (field, value) => {
    setDraft(current => ({ ...current, [field]: value }));
    setErrors(current => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setMessage(null);
  };

  const save = async () => {
    const found = validateDraft(draft);
    setErrors(found);
    if (Object.keys(found).length) {
      setTab(FIELD_TAB[Object.keys(found)[0]] || 'details');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const data = await updateCommunity(slug, changes);
      const next = toDraft(data.community);
      setState(current => ({ ...current, community: data.community }));
      setDraft(next);
      setSaved(next);
      setMessage({
        tone: 'ok',
        text: data.approvedRequests
          ? `Saved. ${data.approvedRequests} pending request${data.approvedRequests === 1 ? ' was' : 's were'} approved because the community is now public.`
          : 'Saved. The community page and discovery cards now show these changes.',
      });
      if (data.approvedRequests) loadMembers();
    } catch (err) {
      const payload = err.response?.data;
      if (payload?.fields) {
        setErrors(payload.fields);
        setTab(FIELD_TAB[Object.keys(payload.fields)[0]] || 'details');
      }
      setMessage({ tone: 'bad', text: payload?.error || 'Could not save. Your changes are still here — try again.' });
    } finally {
      setSaving(false);
    }
  };

  const requestSave = () => {
    const opening = changes.privacy === 'public' && lists.pending.length > 0;
    const closing = changes.privacy && changes.privacy !== 'public' && saved.privacy === 'public';
    if (opening || closing) {
      setConfirm({
        title: opening ? 'Make this community public?' : 'Make this community private?',
        message: opening
          ? `${lists.pending.length} pending request${lists.pending.length === 1 ? '' : 's'} will be approved automatically, and anyone will be able to read and join.`
          : 'It will disappear from discovery and search. Current members keep access; new people must request to join.',
        confirmLabel: 'Save changes',
        onConfirm: () => { setConfirm(null); save(); },
      });
      return;
    }
    save();
  };

  const handleImage = async (kind, file) => {
    setImageBusy(kind);
    setImageError(current => ({ ...current, [kind]: '' }));
    try {
      const data = file
        ? await uploadCommunityImage(slug, kind, file)
        : await removeCommunityImage(slug, kind);
      const field = kind === 'avatar' ? 'avatar' : 'coverImage';
      setState(current => ({ ...current, community: { ...current.community, [field]: data.url } }));
      setMessage({ tone: 'ok', text: file ? 'Image updated.' : 'Image removed.' });
    } catch (err) {
      setImageError(current => ({
        ...current,
        [kind]: err.response?.data?.error || 'Could not update the image.',
      }));
    } finally {
      setImageBusy('');
    }
  };

  const runMemberAction = async (item, action) => {
    const userId = item.user?._id;
    if (!userId) return;
    setBusyMember(`${userId}:${action}`);
    setLists(current => ({ ...current, error: '' }));
    try {
      const data = await updateCommunityMember(slug, userId, action);
      setState(current => ({
        ...current,
        community: { ...current.community, memberCount: data.memberCount },
        viewer: { ...current.viewer, pendingRequests: data.pendingRequests },
      }));
      await loadMembers();
    } catch (err) {
      setLists(current => ({
        ...current,
        error: err.response?.data?.error || 'Could not update that member.',
      }));
    } finally {
      setBusyMember('');
    }
  };

  const confirmMemberAction = (item, action, title, text, confirmLabel) => setConfirm({
    title,
    message: text,
    confirmLabel,
    onConfirm: () => { setConfirm(null); runMemberAction(item, action); },
  });

  const memberButton = (item, action, label, tone = 'ghost', confirmCopy = null) => {
    const name = item.user?.name || item.user?.username || 'this member';
    return (
      <button
        key={action}
        type="button"
        className={`cs-btn cs-btn-sm cs-btn-${tone}`}
        disabled={Boolean(busyMember)}
        onClick={() => (confirmCopy
          ? confirmMemberAction(item, action, confirmCopy.title(name), confirmCopy.text(name), label)
          : runMemberAction(item, action))}
      >
        {busyMember === `${item.user?._id}:${action}` ? '…' : label}
      </button>
    );
  };

  const removeCopy = {
    title: name => `Remove ${name}?`,
    text: () => 'They lose access to members-only content and can join or request again later.',
  };
  const banCopy = {
    title: name => `Ban ${name}?`,
    text: () => 'They are removed and cannot rejoin until you lift the ban.',
  };

  if (state.loading) {
    return (
      <div className="cs-comm cs-setup">
        <Navbar />
        <main className="cs-comm-wrap cs-setup-wrap">
          <div className="cs-skeleton" style={{ height: 60, marginBottom: 16 }} />
          <div className="cs-skeleton" style={{ height: 320 }} />
        </main>
      </div>
    );
  }

  if (!community || !canManage) {
    return (
      <div className="cs-comm cs-setup">
        <Navbar />
        <main className="cs-comm-wrap cs-setup-wrap">
          <div className="cs-panel cs-setup-gate">
            <h1>Community settings</h1>
            <p role="alert">{state.error || 'Only the owner and moderators can manage this community.'}</p>
            <div className="cs-comm-actions">
              <Link className="cs-btn cs-btn-ghost" to={community ? `/community/${slug}` : '/community'}>
                {community ? 'Back to the community' : 'Back to Community'}
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const cardPreview = {
    ...community,
    name: draft.name,
    tagline: draft.tagline,
    summary: draft.tagline.trim() || summarizeCommunityText(draft.description),
    category: draft.category,
    categoryLabel: undefined,
    topics: draft.topics,
    privacy: draft.privacy,
  };

  return (
    <div className="cs-comm cs-setup">
      <Navbar />
      <main className="cs-comm-wrap cs-setup-wrap">
        <header className="cs-setup-head">
          <Link className="cs-link-btn cs-back" to={`/community/${slug}`}>← {community.name}</Link>
          <span className="cs-comm-kicker">{isOwner ? 'Owner settings' : 'Moderator tools'}</span>
          <h1>Manage community</h1>
          <p>
            {isOwner
              ? 'Edit how the community looks and works, and manage who belongs to it.'
              : 'Review membership requests and manage members. Only the owner can change community details.'}
          </p>
        </header>

        <div className="cs-tabs" role="tablist">
          {tabs.map(item => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              className={`cs-tab${tab === item.key ? ' is-active' : ''}`}
              onClick={() => setTab(item.key)}
            >
              {item.label}
              {item.key === 'requests' && lists.pending.length > 0 && (
                <span className="cs-tab-count">{lists.pending.length}</span>
              )}
            </button>
          ))}
        </div>

        {message && (
          <p className={`cs-notice is-${message.tone}`} role={message.tone === 'bad' ? 'alert' : 'status'}>
            {message.text}
          </p>
        )}

        {isOwner && tab === 'details' && (
          <div className="cs-setup-grid">
            <div className="cs-setup-form">
              <Field
                id="settings-name"
                label="Community name"
                error={errors.name}
                counter={<Counter value={draft.name} max={LIMITS.nameMax} />}
              >
                <input
                  id="settings-name"
                  value={draft.name}
                  maxLength={LIMITS.nameMax}
                  aria-invalid={Boolean(errors.name)}
                  onChange={event => setField('name', event.target.value)}
                />
              </Field>
              <Field
                id="settings-slug"
                label="Web address"
                hint="Fixed after creation so shared links and notifications keep working."
              >
                <div className="cs-slug is-locked">
                  <span aria-hidden="true">/community/</span>
                  <input id="settings-slug" value={community.slug} readOnly aria-readonly="true" />
                </div>
              </Field>
              <Field
                id="settings-tagline"
                label="Tagline"
                optional
                error={errors.tagline}
                counter={<Counter value={draft.tagline} max={LIMITS.taglineMax} />}
              >
                <input
                  id="settings-tagline"
                  value={draft.tagline}
                  maxLength={LIMITS.taglineMax}
                  onChange={event => setField('tagline', event.target.value)}
                />
              </Field>
              <div className="cs-image-grid">
                <ImagePicker
                  kind="avatar"
                  label="Community icon"
                  hint="Saved as soon as you choose it. JPEG, PNG, WebP or GIF, up to 5 MB."
                  src={community.avatar}
                  busy={imageBusy === 'avatar'}
                  error={imageError.avatar}
                  onPick={file => handleImage('avatar', file)}
                  onRemove={() => setConfirm({
                    title: 'Remove the community icon?',
                    message: 'The community will show its initial instead.',
                    confirmLabel: 'Remove icon',
                    onConfirm: () => { setConfirm(null); handleImage('avatar', null); },
                  })}
                />
                <ImagePicker
                  kind="cover"
                  label="Cover banner"
                  hint="Saved as soon as you choose it. JPEG, PNG, WebP or GIF, up to 5 MB."
                  src={community.coverImage}
                  busy={imageBusy === 'cover'}
                  error={imageError.cover}
                  onPick={file => handleImage('cover', file)}
                  onRemove={() => setConfirm({
                    title: 'Remove the cover banner?',
                    message: 'The community will show a plain banner instead.',
                    confirmLabel: 'Remove banner',
                    onConfirm: () => { setConfirm(null); handleImage('cover', null); },
                  })}
                />
              </div>
              <AboutEditor
                id="settings-about"
                value={draft.description}
                error={errors.description}
                onChange={value => setField('description', value)}
              />
              <CategoryPicker
                value={draft.category}
                error={errors.category}
                onChange={value => setField('category', value)}
              />
              <TopicsInput
                topics={draft.topics}
                error={errors.topics}
                onChange={value => setField('topics', value)}
              />
            </div>
            <aside className="cs-setup-aside is-open">
              <div className="cs-setup-aside-body">
                <p className="cs-setup-aside-title">Discovery card</p>
                <div className="cs-preview-card">
                  <CommunityCard community={cardPreview} preview />
                </div>
              </div>
            </aside>
          </div>
        )}

        {isOwner && tab === 'rules' && (
          <div className="cs-setup-form cs-setup-form--narrow">
            <RulesEditor rules={draft.rules} error={errors.rules} onChange={value => setField('rules', value)} />
            <PrivacyPicker value={draft.privacy} error={errors.privacy} onChange={value => setField('privacy', value)} />
          </div>
        )}

        {isOwner && (tab === 'details' || tab === 'rules') && (
          <div className={`cs-save-bar${dirty ? ' is-dirty' : ''}`}>
            <span>{dirty ? 'You have unsaved changes.' : 'Everything is saved.'}</span>
            <div className="cs-comm-actions">
              <button
                type="button"
                className="cs-btn cs-btn-ghost"
                disabled={!dirty || saving}
                onClick={() => { setDraft(saved); setErrors({}); setMessage(null); }}
              >
                Discard changes
              </button>
              <button type="button" className="cs-btn cs-btn-gold" disabled={!dirty || saving} onClick={requestSave}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        )}

        {tab === 'requests' && (
          <section className="cs-manage">
            <h2>Membership requests</h2>
            <p className="cs-quiet">
              {community.privacy === 'public'
                ? 'This community is public, so people join without a request.'
                : 'People who asked to join. Approving gives them access to discussions, members and media.'}
            </p>
            {lists.error && <p className="cs-form-error" role="alert">{lists.error}</p>}
            {lists.loading && <div className="cs-skeleton" style={{ height: 70 }} />}
            {!lists.loading && !lists.pending.length && <div className="cs-empty">No pending requests.</div>}
            <ul className="cs-manage-list">
              {lists.pending.map(item => (
                <MemberRow key={item.user._id} item={item}>
                  {memberButton(item, 'approve', 'Approve', 'gold')}
                  {memberButton(item, 'decline', 'Decline')}
                </MemberRow>
              ))}
            </ul>
          </section>
        )}

        {tab === 'members' && (
          <section className="cs-manage">
            <h2>Members <span className="cs-quiet">({lists.active.length})</span></h2>
            {lists.error && <p className="cs-form-error" role="alert">{lists.error}</p>}
            {lists.loading && <div className="cs-skeleton" style={{ height: 70 }} />}
            <ul className="cs-manage-list">
              {lists.active.map(item => {
                const plain = item.role === 'member';
                const moderator = item.role === 'moderator';
                return (
                  <MemberRow key={item.user._id} item={item}>
                    {item.role === 'owner' && <span className="cs-chip">Owner</span>}
                    {isOwner && plain && memberButton(item, 'promote', 'Make moderator')}
                    {isOwner && moderator && memberButton(item, 'demote', 'Remove as moderator')}
                    {(plain || (isOwner && moderator)) && memberButton(item, 'remove', 'Remove', 'ghost', removeCopy)}
                    {(plain || (isOwner && moderator)) && memberButton(item, 'ban', 'Ban', 'primary', banCopy)}
                    {!isOwner && moderator && <span className="cs-chip cs-chip-quiet">Moderator</span>}
                  </MemberRow>
                );
              })}
            </ul>

            {lists.banned.length > 0 && (
              <>
                <h2>Banned <span className="cs-quiet">({lists.banned.length})</span></h2>
                <ul className="cs-manage-list">
                  {lists.banned.map(item => (
                    <MemberRow key={item.user._id} item={item}>
                      {memberButton(item, 'unban', 'Lift ban')}
                    </MemberRow>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
      </main>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
