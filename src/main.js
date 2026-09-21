import { Actor, log } from 'apify';

// A thin wrapper around https://www.gstinapi.in/docs. One HTTP call per GSTIN,
// one flat dataset row per GSTIN.
const BASE_URL = (process.env.GSTINAPI_BASE_URL || 'https://www.gstinapi.in').replace(/\/+$/, '');

// The API allows 60 requests a minute per key. Starting at most one request
// every 1.1 s keeps a single run under that, so a long list does not spend its
// time in 429 retries.
const MIN_INTERVAL_MS = Number(process.env.GSTINAPI_MIN_INTERVAL_MS ?? 1100);

// A documented test number (state code 00 cannot exist on the GST network): the
// API returns a fixed sample result for it and never charges a credit.
const SANDBOX_GSTIN = '00AAAAA0000A1ZT';

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// The API's published retry policy: retry only 429 and 502, with backoff, at
// most 3 attempts. Anything else (400, 401, 402, 404) will not change on a
// retry, so it is returned as-is.
async function fetchWithRetry(url, apiKey, attempts = 3) {
  let res;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    res = await fetch(url, { headers: { 'x-api-key': apiKey } });
    if (res.status !== 429 && res.status !== 502) return res;
    if (attempt < attempts) {
      log.warning(`HTTP ${res.status}, retrying in ${2 * attempt}s (attempt ${attempt} of ${attempts})`);
      await sleep(2000 * attempt);
    }
  }
  return res;
}

function successRow(gstin, body, demo) {
  const { data, credits_remaining, response_ms } = body ?? {};
  return {
    gstin,
    success: true,
    ...(demo ? { demo: true } : {}),
    ...data,
    // The demo key's own balance is not the caller's business.
    ...(demo ? {} : { credits_remaining }),
    response_ms,
    checked_at: new Date().toISOString(),
  };
}

function failureRow(gstin, error, httpStatus) {
  return { gstin, success: false, http_status: httpStatus ?? null, error, checked_at: new Date().toISOString() };
}

await Actor.init();

const input = await Actor.getInput();
const { apiKey, gstins, includeProfile } = input ?? {};

if (!Array.isArray(gstins) || gstins.length === 0) {
  throw new Error('gstins must be a non-empty list of GSTINs');
}

// Each GSTIN that resolves costs one credit, so the same number listed twice
// would be charged twice. Look each one up once.
const seen = new Set();
const unique = [];
for (const raw of gstins) {
  const gstin = String(raw ?? '').trim().toUpperCase();
  if (!gstin) continue;
  if (seen.has(gstin)) {
    log.info(`Skipping duplicate ${gstin}`);
    continue;
  }
  seen.add(gstin);
  unique.push(gstin);
}
if (unique.length === 0) {
  throw new Error('gstins must contain at least one GSTIN');
}

// Demo mode: with no key, the sandbox GSTIN can still be run. The API answers
// it with a fixed sample result and never charges for it, so it is served with
// a demo key kept as a secret Actor environment variable (never in this code).
// This is what lets the Store's automatic daily test, which runs the default
// input with no key, succeed. Any other GSTIN needs the caller's own key.
let key = apiKey;
let demoMode = false;
if (!key) {
  const onlySandbox = unique.every(g => g === SANDBOX_GSTIN);
  if (!onlySandbox) {
    throw new Error('apiKey is required for real GSTINs. Get a free one at https://www.gstinapi.in/register, or leave apiKey empty and use only the sandbox GSTIN 00AAAAA0000A1ZT for a free demo.');
  }
  if (!process.env.GSTINAPI_DEMO_KEY) {
    throw new Error('The keyless demo is not configured on this Actor. Add your gstinapi.in API key to run it.');
  }
  key = process.env.GSTINAPI_DEMO_KEY;
  demoMode = true;
  log.info('No API key given: running the free sandbox demo (no credit is used).');
}

let ok = 0;
let failed = 0;
let lastStart = 0;

for (const [i, gstin] of unique.entries()) {
  await Actor.setStatusMessage(`Verifying ${i + 1} of ${unique.length}`);

  // A malformed number is rejected by the API for free, but there is no reason
  // to spend a request (and a slot in the rate limit) finding that out.
  if (!GSTIN_RE.test(gstin)) {
    await Actor.pushData(failureRow(gstin, 'Not a valid GSTIN format', null));
    failed++;
    continue;
  }

  const wait = lastStart + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastStart = Date.now();

  const url = `${BASE_URL}/v1/gstin/${encodeURIComponent(gstin)}${includeProfile ? '?include=profile' : ''}`;
  log.info(`Looking up ${gstin}`);

  let res;
  try {
    res = await fetchWithRetry(url, key);
  } catch (err) {
    await Actor.pushData(failureRow(gstin, `Request failed: ${err.message}`, null));
    failed++;
    continue;
  }

  const body = await res.json().catch(() => null);
  if (!res.ok || body?.success === false) {
    await Actor.pushData(failureRow(gstin, body?.error || `HTTP ${res.status}`, res.status));
    failed++;
    // Out of credits or a bad key will fail every remaining GSTIN the same way.
    if (res.status === 401 || res.status === 402) {
      log.error(`Stopping: HTTP ${res.status} means every remaining lookup would fail too. ${body?.fix ?? ''}`.trim());
      break;
    }
    continue;
  }

  await Actor.pushData(successRow(gstin, body, demoMode));
  ok++;
}

await Actor.setStatusMessage(`Done: ${ok} verified, ${failed} not verified`);
log.info(`Finished. ${ok} verified, ${failed} not verified.`);
await Actor.exit();
