// src/api/gpt.js — Express router mounted at /api
// Strategy: OpenAI GPT-4o-mini first → OpenRouter (Mistral) fallback

import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import OpenAI from 'openai';
import axios from 'axios';

const router = express.Router();

const DISCOVER_SYSTEM_PROMPT = `You are a cinematic movie recommendation expert — a knowledgeable cinephile.
Interpret user input from a cinephile's perspective and suggest highly relevant films.

Accept free-form natural prompts like "films like Masaan" or "protagonist loses everything".
Understand genre, emotion, character arcs, endings, tones, and keywords.
Respond with 5–8 curated movie titles that match the query.
For each movie: **Title (Year)** – *One-line reason why it fits.*

Always aim for artistic, emotional, intelligent recommendations. No blank results.`;

// ── Unified AI caller ─────────────────────────────────────────────────────────
async function callAI({ messages, temperature = 0.7, maxTokens = 1200 } = {}) {
  // PRIMARY: OpenAI GPT-4o-mini
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature,
        max_tokens: maxTokens,
      });
      const reply = completion.choices[0].message.content;
      console.log('[AI] Served by OpenAI GPT-4o-mini');
      return { reply, source: 'openai' };
    } catch (err) {
      console.warn('[AI] OpenAI failed, trying OpenRouter:', err.message);
    }
  }

  // FALLBACK: OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    const model = process.env.OPENROUTER_MODEL || 'mistralai/mistral-7b-instruct';
    const res = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      { model, messages, temperature },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    const reply = res.data.choices[0].message.content;
    console.log('[AI] Served by OpenRouter (fallback)');
    return { reply, source: 'openrouter' };
  }

  throw new Error('No AI provider configured. Set OPENAI_API_KEY or OPENROUTER_API_KEY.');
}

// ── /moodtags ─────────────────────────────────────────────────────────────────
router.post('/moodtags', async (req, res) => {
  const { phrase } = req.body;
  if (!phrase || typeof phrase !== 'string' || phrase.trim().length < 3) {
    return res.status(400).json({ error: 'A valid phrase is required.' });
  }

  const messages = [
    {
      role: 'system',
      content: `Convert vague user search phrases into structured movie tags.
Return ONLY a valid JSON object: { mood, themes: [], genres: [], example_keywords: [] }. No markdown.`,
    },
    { role: 'user', content: `Convert to movie tags: "${phrase.trim()}"` },
  ];

  try {
    const { reply } = await callAI({ messages, temperature: 0.5, maxTokens: 300 });
    res.status(200).json({ tags: JSON.parse(reply) });
  } catch (err) {
    console.error('MoodTags error:', err.message);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// ── /gpt — movie recommendations ─────────────────────────────────────────────
router.post('/gpt', async (req, res) => {
  const { messages, prompt, temperature, max_tokens: maxTokensBody } = req.body;

  let usedMessages;

  if (Array.isArray(messages) && messages.length > 0) {
    usedMessages = messages;
  } else if (prompt && typeof prompt === 'string' && prompt.trim()) {
    const clean = prompt.trim()
      .replace(/\bmasan\b/gi, 'Masaan')
      .replace(/\blunch\s*box\b/gi, 'The Lunchbox');
    usedMessages = [
      { role: 'system', content: DISCOVER_SYSTEM_PROMPT },
      { role: 'user', content: clean },
    ];
  } else {
    return res.status(400).json({ error: 'Prompt or messages required.' });
  }

  try {
    const { reply, source } = await callAI({
      messages: usedMessages,
      temperature: typeof temperature === 'number' ? temperature : 0.8,
      maxTokens: typeof maxTokensBody === 'number' ? maxTokensBody : 1200,
    });
    res.status(200).json({ reply, source });
  } catch (err) {
    console.error('[AI] All providers failed:', err.message);
    res.status(500).json({ error: 'AI request failed', details: err.message });
  }
});

export default router;
