// Express route for AI-powered film discovery
// Strategy: Try OpenAI GPT-4o-mini first (fast + smart).
// If OpenAI fails (quota, network, etc.) → fall back to OpenRouter (Mistral).

import express from 'express';
import OpenAI from 'openai';
import axios from 'axios';

const router = express.Router();

const SYSTEM_PROMPT = `Your job is to interpret vague, emotional, aesthetic, or misspelled movie prompts from users and return 5 perfect movie suggestions.

Return ONLY a valid JSON array of 5 real movies, based on the user's taste, even if they use:
- Misspelled words (e.g., "emotinal horor" → emotional horror)
- Open-ended vibes (e.g., "lonely poetic films")
- Specific comparisons (e.g., "like Whiplash and Black Swan")
- Genre + mood (e.g., "slow sci-fi with sad ending")

Each object in the array MUST include:
- title: Movie title (string)
- director: Director name (string)
- year: Year of release (number)
- description: Poetic 1–2 line description (string)
- moodTags: Array of 3 lowercase emotional words (e.g., ["gritty", "lonely", "raw"])
- visualTags: Array of 2 lowercase visual aesthetics (e.g., ["noir", "dreamlike"])
- language: Original language (e.g., "English", "French", "Korean")

Infer deeper meaning even if the user gives a vague or minimal prompt.
Return only a pure, valid JSON array with 5 items. No markdown, no headings, no text outside the array.
Do not recommend sequels or TV shows unless directly relevant.
Always use real movies listed on TMDB or IMDb.`;

// Try OpenAI GPT-4o-mini → fallback to OpenRouter
async function callAI(messages, temperature = 0.7) {
  // ── PRIMARY: OpenAI ──────────────────────────────────────────
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature,
        max_tokens: 1200,
      });
      const reply = completion.choices[0].message.content;
      console.log('[AI] Served by OpenAI GPT-4o-mini');
      return { reply, source: 'openai' };
    } catch (err) {
      console.warn('[AI] OpenAI failed, falling back to OpenRouter:', err.message);
    }
  }

  // ── FALLBACK: OpenRouter (Mistral) ───────────────────────────
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

  throw new Error('No AI provider configured');
}

router.post('/gpt', async (req, res) => {
  const { messages, prompt, temperature, model } = req.body;

  let usedMessages;
  if (Array.isArray(messages) && messages.length > 0) {
    usedMessages = messages;
  } else if (prompt && typeof prompt === 'string' && prompt.trim()) {
    usedMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt.trim() },
    ];
  } else {
    return res.status(400).json({ error: 'Missing prompt or messages' });
  }

  try {
    const { reply, source } = await callAI(usedMessages, typeof temperature === 'number' ? temperature : 0.7);
    res.status(200).json({ reply, source });
  } catch (err) {
    console.error('[AI] All providers failed:', err.message);
    res.status(500).json({ error: 'AI request failed', details: err.message });
  }
});

export default router;
