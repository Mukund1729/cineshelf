import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from '../components/community/CommunitySetupFields';
import CommunityPreview, { buildPreviewCommunity } from '../components/community/CommunityPreview';
import {
  checkCommunityAvailability,
  createCommunity,
  uploadCommunityImage,
} from '../api/community';
import { hasAuthSession } from '../api/session';
import {
  COMMUNITY_LIMITS as LIMITS,
  COMMUNITY_PRIVACY,
  RESERVED_COMMUNITY_SLUGS,
  SLUG_RE,
  communityCategoryLabel,
  slugifyCommunity,
} from '../../data/communityOptions.js';
import './community.css';

const STEPS = [
  {
    key: 'identity',
    label: 'Identity',
    title: 'Name it and give it a face',
    blurb: 'The name is the only thing required here. An icon and banner make it recognisable.',
  },
  {
    key: 'about',
    label: 'About',
    title: 'Say what it is for',
    blurb: 'This is what people read before they decide to join. Write it the way you would say it.',
  },
  {
    key: 'topics',
    label: 'Categories & Topics',
    title: 'Help the right people find it',
    blurb: 'One category, plus a few topics if you like. Both are used by search and filters.',
  },
  {
    key: 'rules',
    label: 'Rules & Privacy',
    title: 'Set the tone and decide who gets in',
    blurb: 'Rules are optional. Privacy decides who can read and who can join.',
  },
  {
    key: 'preview',
    label: 'Preview & Create',
    title: 'Check it over',
    blurb: 'This is how the community will look. Nothing has been saved yet.',
  },
];

const DRAFT_KEY = 'cineshelf:community-draft:v1';
const EMPTY_FORM = {
  name: '',
  slug: '',
  slugManual: false,
  tagline: '',
  description: '',
  category: '',
  topics: [],
  rules: [],
  privacy: 'public',
};
const FIELD_STEP = {
  name: 0, slug: 0, tagline: 0, avatar: 0, coverImage: 0,
  description: 1,
  category: 2, topics: 2,
  rules: 3, privacy: 3,
};

function loadDraft() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
    if (!saved || typeof saved !== 'object' || !saved.form) return null;
    const form = { ...EMPTY_FORM, ...saved.form };
    form.topics = Array.isArray(form.topics) ? form.topics.filter(item => typeof item === 'string') : [];
    form.rules = Array.isArray(form.rules)
      ? form.rules.filter(rule => rule && typeof rule === 'object' && rule.key)
      : [];
    const step = Number.isInteger(saved.step) ? Math.min(Math.max(saved.step, 0), STEPS.length - 1) : 0;
    return { form, step };
  } catch {
    return null;
  }
}

function isBlank(form) {
  return !form.name.trim() && !form.tagline.trim() && !form.description.trim()
    && !form.category && !form.topics.length && !form.rules.length && form.privacy === 'public';
}

function slugProblem(slug) {
  if (!slug) return 'Choose a web address for the community.';
  if (RESERVED_COMMUNITY_SLUGS.includes(slug)) return 'That web address is reserved. Please choose another.';
  if (slug.length < LIMITS.slugMin || slug.length > LIMITS.slugMax) {
    return `Web address must be ${LIMITS.slugMin}–${LIMITS.slugMax} characters.`;
  }
  if (!SLUG_RE.test(slug)) return 'Use lowercase letters, numbers and single hyphens only.';
  return '';
}

function validateStep(form, step) {
  const errors = {};
  if (step === 0) {
    const name = form.name.trim();
    if (name.length < LIMITS.nameMin || name.length > LIMITS.nameMax) {
      errors.name = name
        ? `Name must be ${LIMITS.nameMin}–${LIMITS.nameMax} characters.`
        : 'Give your community a name.';
    }
    const problem = slugProblem(form.slug);
    if (problem) errors.slug = problem;
    if (form.tagline.trim().length > LIMITS.taglineMax) {
      errors.tagline = `Tagline can be up to ${LIMITS.taglineMax} characters.`;
    }
  }
  if (step === 1) {
    const length = form.description.trim().length;
    if (length < LIMITS.descriptionMin) {
      errors.description = length
        ? `Add a little more — at least ${LIMITS.descriptionMin} characters (${length} so far).`
        : 'Write a few words about what this community is for.';
    } else if (length > LIMITS.descriptionMax) {
      errors.description = `About can be up to ${LIMITS.descriptionMax} characters.`;
    }
  }
  if (step === 3) {
    const incomplete = form.rules.some(rule => (
      (rule.title.trim() || rule.body.trim()) && rule.title.trim().length < LIMITS.ruleTitleMin
    ));
    if (incomplete) errors.rules = `Every rule needs a short title (at least ${LIMITS.ruleTitleMin} characters).`;
  }
  return errors;
}

function useObjectUrl(file) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!file) {
      setUrl('');
      return undefined;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

export default function CommunityCreatePage() {
  const navigate = useNavigate();
  const initial = useMemo(loadDraft, []);
  const [form, setForm] = useState(initial?.form || EMPTY_FORM);
  const [step, setStep] = useState(initial?.step || 0);
  const [restored, setRestored] = useState(Boolean(initial && !isBlank(initial.form)));
  const [errors, setErrors] = useState({});
  const [availability, setAvailability] = useState({ slug: { status: 'idle' }, name: { status: 'idle' } });
  const [avatarFile, setAvatarFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [saving, setSaving] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(hasAuthSession());
  const savingRef = useRef(false);
  const finishedRef = useRef(false);
  const headingRef = useRef(null);
  const avatarUrl = useObjectUrl(avatarFile);
  const coverUrl = useObjectUrl(coverFile);

  const dirty = !isBlank(form) || Boolean(avatarFile || coverFile);
  const preview = useMemo(
    () => buildPreviewCommunity(form, { avatar: avatarUrl, cover: coverUrl }),
    [form, avatarUrl, coverUrl]
  );

  // Keep the text of the draft for this browser tab, so moving between steps,
  // refreshing or wandering off to another page never loses what was typed.
  useEffect(() => {
    if (finishedRef.current) return;
    try {
      if (isBlank(form)) sessionStorage.removeItem(DRAFT_KEY);
      else sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step }));
    } catch {
      /* storage unavailable — the in-memory state still holds everything */
    }
  }, [form, step]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = event => {
      if (finishedRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    const refresh = () => setSignedIn(hasAuthSession());
    window.addEventListener('profile-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('profile-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // Live availability for the name and web address.
  const nameQuery = form.name.trim();
  const slugQuery = form.slug;
  useEffect(() => {
    if (!signedIn) return undefined;
    const slugOk = slugQuery && !slugProblem(slugQuery);
    const nameOk = nameQuery.length >= LIMITS.nameMin;
    setAvailability(current => ({
      slug: slugOk ? { status: 'checking' } : { status: 'idle' },
      name: nameOk ? current.name : { status: 'idle' },
    }));
    if (!slugOk && !nameOk) return undefined;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await checkCommunityAvailability({
          slug: slugOk ? slugQuery : '',
          name: nameOk ? nameQuery : '',
        }, controller.signal);
        setAvailability({
          slug: data.slug
            ? {
              status: data.slug.available ? 'available' : (data.slug.valid ? 'taken' : 'invalid'),
              message: data.slug.message,
              suggestion: data.slug.suggestion || '',
            }
            : { status: 'idle' },
          name: data.name
            ? { status: data.name.available ? 'available' : 'taken', message: data.name.message }
            : { status: 'idle' },
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        // Not fatal: the server checks again when the community is created.
        setAvailability({ slug: { status: 'unknown' }, name: { status: 'idle' } });
      }
    }, 450);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [nameQuery, slugQuery, signedIn]);

  const clearError = field => setErrors(current => {
    if (!current[field]) return current;
    const next = { ...current };
    delete next[field];
    return next;
  });

  const setField = (field, value) => {
    setForm(current => ({ ...current, [field]: value }));
    clearError(field);
    setSubmitError('');
  };

  const handleName = value => {
    setForm(current => ({
      ...current,
      name: value,
      slug: current.slugManual ? current.slug : slugifyCommunity(value),
    }));
    clearError('name');
    clearError('slug');
    setSubmitError('');
  };

  const handleSlug = value => {
    const typed = value
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-/, '')
      .slice(0, LIMITS.slugMax);
    setForm(current => (typed
      ? { ...current, slug: typed, slugManual: true }
      // Clearing the field hands control back to the name.
      : { ...current, slug: slugifyCommunity(current.name), slugManual: false }));
    clearError('slug');
    setSubmitError('');
  };

  const goTo = useCallback(index => {
    setStep(Math.min(Math.max(index, 0), STEPS.length - 1));
    setPreviewOpen(false);
    requestAnimationFrame(() => {
      headingRef.current?.focus({ preventScroll: true });
      headingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const availabilityErrors = () => {
    const found = {};
    if (availability.name.status === 'taken') found.name = 'A community with this name already exists. Try a more specific name.';
    if (availability.slug.status === 'taken') found.slug = 'That web address is already taken.';
    if (availability.slug.status === 'invalid') found.slug = availability.slug.message || 'That web address is not available.';
    return found;
  };

  const handleContinue = () => {
    const found = { ...validateStep(form, step), ...(step === 0 ? availabilityErrors() : {}) };
    setErrors(found);
    if (Object.keys(found).length) return;
    goTo(step + 1);
  };

  const allErrors = () => ({
    ...validateStep(form, 0),
    ...validateStep(form, 1),
    ...validateStep(form, 3),
    ...availabilityErrors(),
  });

  const jumpToFirstError = found => {
    const steps = Object.keys(found).map(field => FIELD_STEP[field] ?? 0);
    if (steps.length) goTo(Math.min(...steps));
  };

  const handleCreate = async () => {
    if (savingRef.current) return;
    if (!hasAuthSession()) {
      window.dispatchEvent(new CustomEvent('open-auth-modal'));
      return;
    }
    const found = allErrors();
    setErrors(found);
    if (Object.keys(found).length) {
      jumpToFirstError(found);
      return;
    }

    savingRef.current = true;
    setSaving('Creating community…');
    setSubmitError('');
    try {
      const data = await createCommunity({
        name: form.name.trim(),
        slug: form.slug,
        tagline: form.tagline.trim(),
        description: form.description.trim(),
        category: form.category || 'other',
        topics: form.topics,
        rules: form.rules
          .filter(rule => rule.title.trim())
          .map(rule => ({ title: rule.title.trim(), body: rule.body.trim() })),
        privacy: form.privacy,
      });
      const community = data.community;

      // Images are sent only after the community exists, so an abandoned or
      // failed setup never leaves stray uploads behind.
      const notices = [];
      const uploads = [['avatar', avatarFile, 'icon'], ['cover', coverFile, 'banner']].filter(item => item[1]);
      if (uploads.length) setSaving('Uploading images…');
      for (const [kind, file, label] of uploads) {
        try {
          await uploadCommunityImage(community.slug, kind, file);
        } catch (err) {
          notices.push(`The ${label} could not be uploaded (${err.response?.data?.error || 'network error'}). You can add it in Settings.`);
        }
      }

      finishedRef.current = true;
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      navigate(`/community/${community.slug}?welcome=1`, {
        replace: true,
        state: { justCreated: true, notices },
      });
    } catch (err) {
      const payload = err.response?.data;
      if (err.response?.status === 401) {
        setSubmitError('Your session has expired. Sign in again — your draft is still here.');
        window.dispatchEvent(new CustomEvent('open-auth-modal'));
      } else if (payload?.fields && Object.keys(payload.fields).length) {
        setErrors(payload.fields);
        if (payload.suggestion) {
          setAvailability(current => ({
            ...current,
            slug: { status: 'taken', message: payload.error, suggestion: payload.suggestion },
          }));
        }
        setSubmitError(payload.error || 'Please fix the highlighted fields.');
        jumpToFirstError(payload.fields);
      } else if (err.response?.status === 429) {
        setSubmitError('Too many attempts in a short time. Please wait a few minutes and try again — your draft is safe.');
      } else {
        setSubmitError(payload?.error || 'Could not create the community. Check your connection and try again — nothing was lost.');
      }
    } finally {
      savingRef.current = false;
      setSaving('');
    }
  };

  const handleSubmit = event => {
    event.preventDefault();
    if (step < STEPS.length - 1) handleContinue();
    else handleCreate();
  };

  const discardDraft = () => {
    finishedRef.current = true;
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  };

  const requestCancel = () => {
    if (!dirty) {
      navigate('/community');
      return;
    }
    setConfirm({
      title: 'Leave community setup?',
      message: 'You have unsaved changes. Discarding removes this draft; nothing has been created yet.',
      confirmLabel: 'Discard and leave',
      cancelLabel: 'Keep editing',
      onConfirm: () => {
        discardDraft();
        navigate('/community');
      },
    });
  };

  const requestStartOver = () => setConfirm({
    title: 'Start over?',
    message: 'This clears everything you have entered in this draft.',
    confirmLabel: 'Clear draft',
    cancelLabel: 'Keep it',
    onConfirm: () => {
      setForm(EMPTY_FORM);
      setAvatarFile(null);
      setCoverFile(null);
      setErrors({});
      setSubmitError('');
      setRestored(false);
      setConfirm(null);
      goTo(0);
    },
  });

  const slugState = availability.slug;
  const slugNote = errors.slug ? null : (
    slugState.status === 'checking' ? { tone: 'muted', text: 'Checking availability…' }
      : slugState.status === 'available' ? { tone: 'ok', text: 'This web address is available.' }
        : slugState.status === 'taken' ? { tone: 'bad', text: 'That web address is already taken.' }
          : slugState.status === 'invalid' ? { tone: 'bad', text: slugState.message }
            : slugState.status === 'unknown' ? { tone: 'muted', text: 'Could not check right now — it will be verified when you create.' }
              : null
  );
  const reviewIssues = step === STEPS.length - 1 ? allErrors() : {};
  const current = STEPS[step];

  if (!signedIn) {
    return (
      <div className="cs-comm cs-setup">
        <Navbar />
        <main className="cs-comm-wrap cs-setup-wrap">
          <div className="cs-panel cs-setup-gate">
            <span className="cs-comm-kicker">Found a Society</span>
            <h1>Sign in to create a community</h1>
            <p>Communities belong to the CineShelf account that founds them.</p>
            <div className="cs-comm-actions">
              <button
                type="button"
                className="cs-btn cs-btn-gold"
                onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal'))}
              >
                Sign in
              </button>
              <button type="button" className="cs-btn cs-btn-ghost" onClick={() => navigate('/community')}>
                Back to Community
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="cs-comm cs-setup">
      <Navbar />
      <main className="cs-comm-wrap cs-setup-wrap">
        <header className="cs-setup-head">
          <button type="button" className="cs-link-btn cs-back" onClick={requestCancel}>← Community</button>
          <span className="cs-comm-kicker">Found a Society</span>
          <h1>Create your community</h1>
          <p>Five short steps. Only a name and an About are required — everything else can wait.</p>
        </header>

        <nav className="cs-steps" aria-label="Setup progress">
          <ol>
            {STEPS.map((item, index) => {
              const complete = index < step && !Object.keys(validateStep(form, index)).length;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    className={`cs-step${index === step ? ' is-current' : ''}${complete ? ' is-done' : ''}`}
                    aria-current={index === step ? 'step' : undefined}
                    onClick={() => goTo(index)}
                  >
                    <span className="cs-step-num" aria-hidden="true">{complete ? '✓' : index + 1}</span>
                    <span className="cs-step-label">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div
            className="cs-progress"
            role="progressbar"
            aria-label="Setup progress"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={step + 1}
            aria-valuetext={`Step ${step + 1} of ${STEPS.length}: ${current.label}`}
          >
            <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
        </nav>

        {restored && (
          <div className="cs-notice" role="status">
            <span>
              Picked up your earlier draft.
              {' '}Images are not kept in a draft, so choose them again if you had added any.
            </span>
            <span className="cs-notice-actions">
              <button type="button" className="cs-link-btn" onClick={requestStartOver}>Start over</button>
              <button type="button" className="cs-link-btn" onClick={() => setRestored(false)}>Dismiss</button>
            </span>
          </div>
        )}

        <div className={`cs-setup-grid${step === STEPS.length - 1 ? ' is-review' : ''}`}>
          <form className="cs-setup-form" onSubmit={handleSubmit} noValidate>
            <div className="cs-setup-step-head">
              <span className="cs-setup-count">Step {step + 1} of {STEPS.length} · {current.label}</span>
              <h2 ref={headingRef} tabIndex={-1}>{current.title}</h2>
              <p>{current.blurb}</p>
            </div>

            {step === 0 && (
              <>
                <Field
                  id="community-name"
                  label="Community name"
                  error={errors.name}
                  hint="Required. Names are unique across CineShelf."
                  counter={<Counter value={form.name} max={LIMITS.nameMax} />}
                >
                  <input
                    id="community-name"
                    value={form.name}
                    maxLength={LIMITS.nameMax}
                    autoComplete="off"
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby="community-name-note"
                    placeholder="e.g. The Long Take Society"
                    onChange={event => handleName(event.target.value)}
                  />
                </Field>
                {!errors.name && availability.name.status === 'taken' && (
                  <p className="cs-field-status is-bad" role="status">
                    A community with this name already exists. Try a more specific name.
                  </p>
                )}

                <Field
                  id="community-slug"
                  label="Web address"
                  error={errors.slug}
                  hint="Filled in from the name. Lowercase letters, numbers and hyphens. It cannot be changed later."
                >
                  <div className="cs-slug">
                    <span aria-hidden="true">/community/</span>
                    <input
                      id="community-slug"
                      value={form.slug}
                      maxLength={LIMITS.slugMax}
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      aria-invalid={Boolean(errors.slug)}
                      aria-describedby="community-slug-note"
                      placeholder="the-long-take-society"
                      onChange={event => handleSlug(event.target.value)}
                      onBlur={() => form.slug && setForm(state => ({ ...state, slug: slugifyCommunity(state.slug) }))}
                    />
                  </div>
                </Field>
                {slugNote && (
                  <p className={`cs-field-status is-${slugNote.tone}`} role="status">
                    {slugNote.text}
                    {slugState.suggestion && (
                      <button
                        type="button"
                        className="cs-link-btn"
                        onClick={() => handleSlug(slugState.suggestion)}
                      >
                        Use “{slugState.suggestion}”
                      </button>
                    )}
                  </p>
                )}
                {errors.slug && slugState.suggestion && (
                  <p className="cs-field-status is-muted">
                    <button type="button" className="cs-link-btn" onClick={() => handleSlug(slugState.suggestion)}>
                      Use “{slugState.suggestion}” instead
                    </button>
                  </p>
                )}

                <Field
                  id="community-tagline"
                  label="Tagline"
                  optional
                  error={errors.tagline}
                  hint="One line shown on cards and under the name."
                  counter={<Counter value={form.tagline} max={LIMITS.taglineMax} />}
                >
                  <input
                    id="community-tagline"
                    value={form.tagline}
                    maxLength={LIMITS.taglineMax}
                    aria-describedby="community-tagline-note"
                    placeholder="e.g. For people who never look away before the cut."
                    onChange={event => setField('tagline', event.target.value)}
                  />
                </Field>

                <div className="cs-image-grid">
                  <ImagePicker
                    kind="avatar"
                    label="Community icon"
                    hint="Square works best. JPEG, PNG, WebP or GIF, up to 5 MB."
                    src={avatarUrl}
                    onPick={setAvatarFile}
                    onRemove={() => setAvatarFile(null)}
                  />
                  <ImagePicker
                    kind="cover"
                    label="Cover banner"
                    hint="Wide image, around 1600 × 600. JPEG, PNG, WebP or GIF, up to 5 MB."
                    src={coverUrl}
                    onPick={setCoverFile}
                    onRemove={() => setCoverFile(null)}
                  />
                </div>
              </>
            )}

            {step === 1 && (
              <AboutEditor
                value={form.description}
                error={errors.description}
                onChange={value => setField('description', value)}
              />
            )}

            {step === 2 && (
              <>
                <CategoryPicker
                  value={form.category}
                  error={errors.category}
                  onChange={value => setField('category', value)}
                />
                <TopicsInput
                  topics={form.topics}
                  error={errors.topics}
                  onChange={value => setField('topics', value)}
                />
              </>
            )}

            {step === 3 && (
              <>
                <RulesEditor
                  rules={form.rules}
                  error={errors.rules}
                  onChange={value => setField('rules', value)}
                />
                <PrivacyPicker
                  value={form.privacy}
                  error={errors.privacy}
                  onChange={value => setField('privacy', value)}
                />
              </>
            )}

            {step === 4 && (
              <>
                {Object.keys(reviewIssues).length > 0 ? (
                  <div className="cs-review-issues" role="alert">
                    <strong>A few things need attention before you can create it:</strong>
                    <ul>
                      {Object.entries(reviewIssues).map(([field, message]) => (
                        <li key={field}>
                          {message}
                          <button type="button" className="cs-link-btn" onClick={() => goTo(FIELD_STEP[field] ?? 0)}>
                            Fix
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <dl className="cs-review-list">
                    <div><dt>Name</dt><dd>{form.name.trim()}</dd></div>
                    <div><dt>Web address</dt><dd>/community/{form.slug}</dd></div>
                    <div><dt>Category</dt><dd>{communityCategoryLabel(form.category || 'other')}</dd></div>
                    <div><dt>Topics</dt><dd>{form.topics.length ? form.topics.join(', ') : 'None'}</dd></div>
                    <div><dt>Rules</dt><dd>{form.rules.filter(rule => rule.title.trim()).length || 'None'}</dd></div>
                    <div><dt>Visibility</dt><dd>{COMMUNITY_PRIVACY[form.privacy].label} — {COMMUNITY_PRIVACY[form.privacy].summary}</dd></div>
                    <div><dt>Images</dt><dd>{[avatarFile && 'Icon', coverFile && 'Banner'].filter(Boolean).join(' and ') || 'None'}</dd></div>
                  </dl>
                )}
                <CommunityPreview community={preview} full />
                <p className="cs-field-hint">
                  When you create it, you become the Owner and its first member. Everything except the
                  web address can be edited later in Settings.
                </p>
              </>
            )}

            {Object.keys(errors).length > 0 && step < 4 && (
              <p className="cs-form-error" role="alert">Please fix the highlighted field{Object.keys(errors).length > 1 ? 's' : ''} to continue.</p>
            )}
            {submitError && <p className="cs-form-error" role="alert">{submitError}</p>}

            <div className="cs-setup-nav">
              <button
                type="button"
                className="cs-btn cs-btn-ghost"
                disabled={step === 0 || Boolean(saving)}
                onClick={() => goTo(step - 1)}
              >
                Back
              </button>
              {step < STEPS.length - 1 ? (
                <button type="submit" className="cs-btn cs-btn-gold">Continue</button>
              ) : (
                <button
                  type="submit"
                  className="cs-btn cs-btn-gold"
                  disabled={Boolean(saving) || Object.keys(reviewIssues).length > 0}
                >
                  {saving || 'Create community'}
                </button>
              )}
              <button type="button" className="cs-link-btn cs-setup-cancel" disabled={Boolean(saving)} onClick={requestCancel}>
                Cancel
              </button>
            </div>
          </form>

          {step < STEPS.length - 1 && (
            <aside className={`cs-setup-aside${previewOpen ? ' is-open' : ''}`}>
              <button
                type="button"
                className="cs-btn cs-btn-ghost cs-btn-sm cs-setup-preview-toggle"
                aria-expanded={previewOpen}
                onClick={() => setPreviewOpen(open => !open)}
              >
                {previewOpen ? 'Hide preview' : 'Show live preview'}
              </button>
              <div className="cs-setup-aside-body">
                <p className="cs-setup-aside-title">Live preview</p>
                <CommunityPreview community={preview} />
              </div>
            </aside>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        cancelLabel={confirm?.cancelLabel}
        danger
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
