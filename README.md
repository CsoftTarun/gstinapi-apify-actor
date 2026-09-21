# GSTIN Verification (India GST)

Verify a list of Indian GSTINs in one run. For each GST number you get the registered legal name, trade name, **active / cancelled / suspended status**, taxpayer type, registration date, cancellation date and address, read live from the GST network. Export the result as JSON, CSV or Excel from the dataset.

Built on [gstinapi.in](https://www.gstinapi.in), a REST API for GSTIN verification. Nothing is served from a cache, so a registration cancelled this morning shows as cancelled.

## What you can use it for

- Check a vendor list before you claim input tax credit, and find cancelled or suspended suppliers.
- Clean a customer or party master: catch mistyped GSTINs and the legal name each number really belongs to.
- Verify GST numbers as part of onboarding, KYC or a marketplace seller check.

## How to use it

1. Get a free API key at [gstinapi.in/register](https://www.gstinapi.in/register). Every account starts with up to 100 free lookups (25 on signup, 25 for each of three setup steps), with no card, and credits never expire.
2. Paste the key into **gstinapi.in API key**. It is stored as a secret.
3. Paste your GSTINs, one per line, and run.

## Input

| Field | Required | Description |
|---|---|---|
| `apiKey` | Yes | Your gstinapi.in API key. |
| `gstins` | Yes | The 15-character GSTINs to verify, one per line. |
| `includeProfile` | No | Adds jurisdiction codes, e-invoicing status, nature of business and additional places of business, at no extra credit cost. |

## Output

One flat row per GSTIN:

```json
{
  "gstin": "27AAPFU0939F1ZV",
  "success": true,
  "legal_name": "EXAMPLE PRIVATE LIMITED",
  "trade_name": "EXAMPLE PVT LTD",
  "status": "Active",
  "taxpayer_type": "Regular",
  "registration_date": "2017-07-01",
  "cancellation_date": null,
  "state_code": "27",
  "address": "SHOP NO. 12, 1ST FLOOR, 123 BUSINESS PARK, MUMBAI",
  "pincode": "400001",
  "block_status": "Unblocked",
  "credits_remaining": 96,
  "response_ms": 412,
  "checked_at": "2026-09-20T10:15:30.000Z"
}
```

The example values are illustrative. The full field reference is at [gstinapi.in/docs](https://www.gstinapi.in/docs); with `includeProfile` on, the extra profile fields are added to the same row.

A GSTIN that could not be verified still gets a row, so a run never silently drops a number:

```json
{ "gstin": "27AAAAA0000A1Z5", "success": false, "http_status": 404, "error": "GSTIN not found in GST database", "checked_at": "2026-09-20T10:15:31.000Z" }
```

## What it costs

- Each GSTIN that resolves uses **one credit** from your gstinapi.in account. This Actor adds no charge of its own; you pay Apify only for the platform usage of the run, which is small.
- Malformed numbers, numbers the GST network has no record of, and provider errors are **not charged**.
- The same GSTIN listed twice is looked up once, so you are not charged twice. Malformed numbers are rejected before any request is made.
- Credit packs start at ₹199 for 250 lookups and fall to ₹0.40 a lookup on the largest pack, before 18% GST. See [gstinapi.in/pricing](https://www.gstinapi.in/pricing).

## Speed and limits

The API allows 60 requests a minute per key, so a run verifies roughly 50 GSTINs a minute; 1,000 GSTINs take about 20 minutes. Rate limit responses (429) and temporary upstream errors (502) are retried up to three times with backoff. If your key is invalid or out of credits, the run stops after the first failure instead of failing every remaining number.

## FAQ

**Does it tell me whether a vendor still files GST returns?** This Actor returns registration details and status. Return filing history is available from the same gstinapi.in key through its API and its bulk Excel check; see [gstinapi.in/gst-verification-api](https://www.gstinapi.in/gst-verification-api).

**Is the data live?** Yes. Every lookup queries the GST network when you run it.

**Can I call this from an AI agent instead of running batches?** Yes. gstinapi.in also has an MCP server, [gstinapi-mcp](https://github.com/CsoftTarun/gstinapi-mcp), for Claude and other MCP clients.

**Something looks wrong.** Write to us at [gstinapi.in/contact](https://www.gstinapi.in/contact).
