#!/usr/bin/env node
/**
 * debrief-lab — fast iteration loop for the CIPHER debrief system prompt.
 *
 * Edit scripts/debrief-lab/persona.md, run this, read the answer. No Obsidian rebuild.
 * Streams the model's reply live and then diagnoses WHERE any "thinking" came from:
 *   - reasoning_content channel  → the plugin already drops this (harmless)
 *   - <think>…</think> in content → the plugin's ThinkSplitter strips this (harmless)
 *   - plain prose in content      → PROMPT PROBLEM (this is what you saw in Obsidian)
 *
 * Usage:
 *   node scripts/debrief-lab.mjs                      # default sample, settings from Obsidian data.json
 *   node scripts/debrief-lab.mjs --sample clean_newbest
 *   node scripts/debrief-lab.mjs --all               # run every sample
 *   node scripts/debrief-lab.mjs --no-suppress       # send without the no-think params
 *   node scripts/debrief-lab.mjs --model qwen3-8b --endpoint http://localhost:1234
 *   node scripts/debrief-lab.mjs --persona /tmp/other-persona.md
 *   node scripts/debrief-lab.mjs --knowledge scripts/debrief-lab/knowledge.txt
 *   node scripts/debrief-lab.mjs --list             # list samples and exit
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = join(HERE, 'debrief-lab');
const DEFAULT_DATA_JSON =
  '/Users/Shared/10_ObsidianVaults/10_Pallas/.obsidian/plugins/neurovim/data.json';

// ── args ────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = { flags: new Set(), opts: {} };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--all' || t === '--no-suppress' || t === '--list') a.flags.add(t);
    else if (t.startsWith('--')) a.opts[t.slice(2)] = argv[++i];
  }
  return a;
}
const args = parseArgs(process.argv.slice(2));

// ── config resolution (flags > data.json > fallback) ─────────────────────────
function readSettings() {
  const path = args.opts.data ?? DEFAULT_DATA_JSON;
  try {
    const s = JSON.parse(readFileSync(path, 'utf8')).__settings ?? {};
    return { endpoint: (s.llmEndpoints ?? [])[0], model: s.llmModel, apiKey: s.llmApiKey ?? '' };
  } catch {
    return {};
  }
}
const settings = readSettings();
const ENDPOINT = (args.opts.endpoint ?? settings.endpoint ?? 'http://localhost:1234').replace(/\/+$/, '');
const MODEL = args.opts.model ?? settings.model;
const API_KEY = args.opts.apiKey ?? settings.apiKey ?? '';
const SUPPRESS = !args.flags.has('--no-suppress');

// ── prompt building (mirrors src/llm/debriefPrompt.ts) ───────────────────────
const PERSONA = readFileSync(args.opts.persona ?? join(LAB, 'persona.md'), 'utf8').trim();
const KNOWLEDGE = args.opts.knowledge ? readFileSync(resolve(args.opts.knowledge), 'utf8').trim() : '';
const SAMPLES = JSON.parse(readFileSync(join(LAB, 'samples.json'), 'utf8'));

function systemMessage() {
  const parts = [PERSONA];
  if (KNOWLEDGE) parts.push(`VIM QUICK REFERENCE (your knowledge base):\n${KNOWLEDGE}`);
  return parts.join('\n\n---\n\n');
}

function userMessage(s) {
  const par = s.par != null ? ` (par: ${s.par})` : '';
  const best = s.is_new_best ? ' — NEW BEST' : '';
  return (
    `Debrief this run of mission ${s.mission_id}${best}.\n` +
    `Keystrokes: ${s.keystrokes}${par}. Time: ${s.elapsed_s.toFixed(1)}s.\n` +
    `Keystroke sequence: ${s.sequence}`
  );
}

// Union no-think params — copied from src/vendor/kit/reasoning.ts (standalone tool).
function suppressParams(on) {
  return on ? { reasoning_effort: 'none', chat_template_kwargs: { enable_thinking: false }, reasoning_budget: 0 } : {};
}

// ── streaming call ───────────────────────────────────────────────────────────
async function runOne(name, sample) {
  const messages = [
    { role: 'system', content: systemMessage() },
    { role: 'user', content: userMessage(sample) },
  ];
  const body = {
    model: MODEL,
    messages,
    stream: true,
    temperature: 0.7,
    max_tokens: 512,
    ...suppressParams(SUPPRESS),
  };
  const headers = { 'Content-Type': 'application/json' };
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;

  console.log(`\n\x1b[1m━━━ ${name}\x1b[0m  (${sample.keystrokes} keys, par ${sample.par ?? '—'}, ${sample.elapsed_s}s${sample.is_new_best ? ', NEW BEST' : ''})`);

  const started = Date.now();
  let res;
  try {
    res = await fetch(`${ENDPOINT}/v1/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch (e) {
    console.error(`\x1b[31m✗ connection failed:\x1b[0m ${e.message}\n  (endpoint ${ENDPOINT} reachable? model loaded?)`);
    return;
  }
  if (!res.ok) {
    console.error(`\x1b[31m✗ HTTP ${res.status}:\x1b[0m ${(await res.text()).slice(0, 500)}`);
    return;
  }

  let content = '';
  let reasoning = '';
  let buf = '';
  const decoder = new TextDecoder();
  process.stdout.write('\x1b[2m'); // dim the live stream
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (payload === '[DONE]') continue;
      let json;
      try { json = JSON.parse(payload); } catch { continue; }
      const delta = json.choices?.[0]?.delta ?? {};
      if (delta.content) { content += delta.content; process.stdout.write(delta.content); }
      if (delta.reasoning_content) reasoning += delta.reasoning_content;
    }
  }
  process.stdout.write('\x1b[0m\n');

  diagnose({ content, reasoning, ms: Date.now() - started });
}

// ── diagnosis ────────────────────────────────────────────────────────────────
const THINK_TAG = /<think>([\s\S]*?)<\/think>/;
// Heuristic markers of a model reasoning out loud in the plain content channel.
const LOUD = /\b(I need to|I must|I will|Let me|The user|My instruction|Scanning|Given the|Since I)\b/;

function diagnose({ content, reasoning, ms }) {
  const think = THINK_TAG.exec(content);
  const stripped = content.replace(THINK_TAG, '').trim();

  console.log('\x1b[1m── diagnosis ─────────────────────────────\x1b[0m');
  if (reasoning.trim()) {
    console.log(`\x1b[33m•\x1b[0m reasoning_content channel: ${reasoning.length} chars — plugin DROPS this (harmless).`);
  }
  if (think && think[1].trim()) {
    console.log(`\x1b[33m•\x1b[0m <think> tags in content: ${think[1].length} chars — plugin's ThinkSplitter STRIPS this (harmless).`);
  }
  if (LOUD.test(stripped)) {
    console.log(`\x1b[31m•\x1b[0m PLAIN-CONTENT reasoning detected (markers like "I need to", "Scanning").`);
    console.log(`  \x1b[31mThis is the Obsidian bug: it renders verbatim. → fix the prompt.\x1b[0m`);
  }
  if (!reasoning.trim() && !(think && think[1].trim()) && !LOUD.test(stripped)) {
    console.log(`\x1b[32m•\x1b[0m clean — no reasoning leaked into the answer.`);
  }

  console.log('\x1b[1m── what the operative would see (after ThinkSplitter) ──\x1b[0m');
  console.log(stripped || '\x1b[2m(empty)\x1b[0m');
  const lines = stripped.split('\n').filter((l) => l.trim()).length;
  console.log(`\x1b[2m── ${stripped.length} chars · ${lines} non-empty lines · ${(ms / 1000).toFixed(1)}s · suppress=${SUPPRESS}\x1b[0m`);
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const names = Object.keys(SAMPLES).filter((k) => k !== '_comment');
  if (args.flags.has('--list')) {
    console.log('Samples:');
    for (const n of names) console.log(`  ${n}  (${SAMPLES[n].keystrokes} keys, par ${SAMPLES[n].par ?? '—'})`);
    return;
  }
  if (!MODEL) {
    console.error('✗ no model — pass --model or make sure data.json has __settings.llmModel');
    process.exit(1);
  }
  console.log(`\x1b[2mendpoint ${ENDPOINT} · model ${MODEL} · persona ${args.opts.persona ?? 'debrief-lab/persona.md'}${KNOWLEDGE ? ' · +knowledge' : ''}\x1b[0m`);

  const run = args.flags.has('--all') ? names : [args.opts.sample ?? names[0]];
  for (const name of run) {
    const sample = SAMPLES[name];
    if (!sample) { console.error(`✗ unknown sample "${name}" (try --list)`); continue; }
    await runOne(name, sample);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
