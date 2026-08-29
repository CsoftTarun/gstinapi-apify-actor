import { Actor, log } from 'apify';

// A thin wrapper around https://www.gstinapi.in/docs — no logic of its own.
// One HTTP call per GSTIN, pushed to the dataset as-is.
const BASE_URL = 'https://www.gstinapi.in';

await Actor.init();

const input = await Actor.getInput();
const { apiKey, gstins, includeProfile } = input ?? {};

if (!apiKey) {
  throw new Error('apiKey is required — get a free one at https://www.gstinapi.in/register');
}
if (!Array.isArray(gstins) || gstins.length === 0) {
  throw new Error('gstins must be a non-empty list of GSTINs');
}

for (const raw of gstins) {
  const gstin = String(raw).trim().toUpperCase();
  if (!gstin) continue;

  const url = `${BASE_URL}/v1/gstin/${encodeURIComponent(gstin)}${includeProfile ? '?include=profile' : ''}`;
  log.info(`Looking up ${gstin}`);

  let res;
  try {
    res = await fetch(url, { headers: { 'x-api-key': apiKey } });
  } catch (err) {
    await Actor.pushData({ gstin, success: false, error: `Request failed: ${err.message}` });
    continue;
  }

  // 60 requests/minute on standard accounts (see /docs) — one retry after a
  // fixed backoff covers an accidental burst without adding real complexity.
  if (res.status === 429) {
    log.warning(`Rate limited on ${gstin}, waiting 2s and retrying once`);
    await new Promise(r => setTimeout(r, 2000));
    res = await fetch(url, { headers: { 'x-api-key': apiKey } });
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    await Actor.pushData({ gstin, success: false, error: data?.error || `HTTP ${res.status}` });
    continue;
  }

  await Actor.pushData(data);
}

await Actor.exit();
