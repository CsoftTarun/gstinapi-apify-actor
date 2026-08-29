# GSTIN Verification (India GST)

Bulk-verify Indian GSTINs against the live GST network — legal name, trade name, registration status, taxpayer type, registration date, and address. Every lookup queries the GST network in real time; nothing is served from a cache.

Built on [gstinapi.in](https://www.gstinapi.in) — this Actor is a thin wrapper around that REST API, no logic of its own.

## Input

| Field | Required | Description |
|---|---|---|
| `apiKey` | Yes | Your gstinapi.in API key. Free at [gstinapi.in/register](https://www.gstinapi.in/register) — 100 lookups on signup, no card required. |
| `gstins` | Yes | List of 15-character GSTINs to verify, one per line. |
| `includeProfile` | No | Adds jurisdiction codes, e-invoicing status, and additional places of business — no extra credit cost. |

## Output

One dataset row per GSTIN, with the fields documented at [gstinapi.in/docs](https://www.gstinapi.in/docs) — `gstin`, `legal_name`, `trade_name`, `status`, `taxpayer_type`, `state_code`, `registration_date`, `address`, `city`, `pincode`, plus `address_details`. A failed lookup returns `{ gstin, success: false, error }` instead of stopping the run.

## Billing

Each successful lookup consumes one credit from your gstinapi.in account — prepaid packs from ₹199, credits never expire. Malformed GSTINs are not charged. Pricing: [gstinapi.in/pricing](https://www.gstinapi.in/pricing).

## Also available as an MCP server

For calling this API directly from an AI agent (Claude, etc.) instead of running batch jobs, see [gstinapi-mcp](https://github.com/CsoftTarun/gstinapi-mcp).
