// api/weights.js
//
// GET  /api/weights?exercise=mon-0&set=0
//   -> { history: [{ weight: 50, date: "2026-06-24T10:00:00.000Z" }, ...] }  newest first
//
// GET  /api/weights?exercise=mon-0&allSets=true
//   -> { "0": [...history], "1": [...history], "2": [...history] }
//
// POST /api/weights   body: { exercise: "mon-0", set: 0, weight: 50 }
//   -> appends a new entry with server-side timestamp, returns updated history for that set
//
// Storage shape in KV: one key per exercise+set, e.g. "history:mon-0:0"
// Value: JSON array of { weight, date }, capped at 50 entries (newest first)

import { kv } from '@vercel/kv';

const MAX_HISTORY = 50;

function keyFor(exercise, setIndex) {
  return `history:${exercise}:${setIndex}`;
}

export default async function handler(req, res) {
  // Basic CORS so this also works if you ever load the HTML from a different origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { exercise, set, allSets } = req.query;

      if (!exercise) {
        return res.status(400).json({ error: 'Missing exercise param' });
      }

      if (allSets === 'true') {
        // Fetch up to 6 sets (covers every exercise in this program) in parallel
        const setIndices = [0, 1, 2, 3, 4, 5];
        const results = await Promise.all(
          setIndices.map((i) => kv.get(keyFor(exercise, i)))
        );
        const out = {};
        setIndices.forEach((i, idx) => {
          out[i] = results[idx] || [];
        });
        return res.status(200).json(out);
      }

      if (set === undefined) {
        return res.status(400).json({ error: 'Missing set param' });
      }

      const history = (await kv.get(keyFor(exercise, set))) || [];
      return res.status(200).json({ history });
    }

    if (req.method === 'POST') {
      const { exercise, set, weight } = req.body || {};

      if (!exercise || set === undefined || weight === undefined) {
        return res.status(400).json({ error: 'Missing exercise, set, or weight' });
      }

      const numWeight = Number(weight);
      if (Number.isNaN(numWeight) || numWeight <= 0) {
        return res.status(400).json({ error: 'Weight must be a positive number' });
      }

      const key = keyFor(exercise, set);
      const existing = (await kv.get(key)) || [];

      const entry = { weight: numWeight, date: new Date().toISOString() };

      // Newest first, capped
      const updated = [entry, ...existing].slice(0, MAX_HISTORY);

      await kv.set(key, updated);

      return res.status(200).json({ history: updated });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('KV error:', err);
    return res.status(500).json({ error: 'Storage error', detail: String(err) });
  }
}
