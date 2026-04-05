#!/usr/bin/env bash
# POST /webhooks/gpulse — requires api-gateway + gpulse-api and WEBHOOK_SECRET.
set -euo pipefail
GATEWAY_URL="${GATEWAY_URL:-http://127.0.0.1:4000}"
SECRET="${WEBHOOK_SECRET:?Set WEBHOOK_SECRET to match api-gateway}"

echo "=== First POST (expect 200, applies pipeline) ==="
curl -sS -X POST "${GATEWAY_URL}/webhooks/gpulse" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: ${SECRET}" \
  -d '{"type":"signal","action":"start","strategy":"speed","confidence":0.85,"id":"selftest-001"}' | jq .

echo "=== Duplicate id (expect duplicate: true) ==="
curl -sS -X POST "${GATEWAY_URL}/webhooks/gpulse" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: ${SECRET}" \
  -d '{"type":"signal","action":"start","strategy":"speed","confidence":0.85,"id":"selftest-001"}' | jq .

echo "=== Optional HMAC (expect 200) ==="
BODY='{"type":"signal","action":"pause","id":"selftest-002"}'
SIG=$(WEBHOOK_SECRET="$SECRET" BODY_JSON="$BODY" node --input-type=module -e "
import crypto from 'node:crypto';
const b = Buffer.from(process.env.BODY_JSON ?? '', 'utf8');
const s = process.env.WEBHOOK_SECRET ?? '';
process.stdout.write(crypto.createHmac('sha256', s).update(b).digest('hex'));
")
curl -sS -X POST "${GATEWAY_URL}/webhooks/gpulse" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: ${SECRET}" \
  -H "X-Signature: sha256=${SIG}" \
  -d "$BODY" | jq .

echo "=== Snapshot (direct gpulse-api, bypasses optional JWT on gateway) ==="
GPULSE_URL="${GPULSE_API_URL:-http://127.0.0.1:5052}"
curl -sS "${GPULSE_URL}/execution/snapshot" | jq .
