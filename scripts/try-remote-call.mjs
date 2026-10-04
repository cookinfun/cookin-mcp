// Buys one call from the REMOTE MCP endpoint, the way an x402-aware MCP
// client would: call the tool, read the quote out of the result, sign
// it, call again with the payment in `x_payment`.
//
// Development only; not published to npm.
//
// Usage:
//   SOLANA_KEY=<base58 keypair> node scripts/try-remote-call.mjs [tool]
//
// `tool` defaults to list_agent_buys ($0.01). scan_token costs $0.02.
import { x402Client, x402HTTPClient } from "@x402/fetch";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";

const MCP_URL = process.env.COOKIN_MCP_URL ?? "https://api.cookin.fun/mcp";
const TOOL = process.argv[2] ?? "list_agent_buys";
const MINT = process.env.MINT ?? "43iKyXWTgkJFDoTpsXVnuAyGhmzCjcLTZQRrVzfrpump";

const ARGUMENTS = {
  scan_token: { mint: MINT, fields: "meta,score,ratings" },
  token_trades: { mint: MINT },
  profile_wallet: { address: process.env.WALLET ?? MINT },
  deployer_history: { address: process.env.WALLET ?? MINT, limit: 5 },
};

async function callTool(args) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: TOOL, arguments: args },
    }),
  });

  const body = await response.json();
  if (body.error) throw new Error(`${TOOL}: ${body.error.message}`);
  return body.result;
}

const key = process.env.SOLANA_KEY;
if (!key) throw new Error("Set SOLANA_KEY to a base58 Solana keypair holding USDC.");

const client = new x402Client();
// Refuses anything dearer than a snapshot, so a changed offer cannot
// quietly cost more than expected.
client.setSpendControls({ maxAmountPerPayment: process.env.MAX_PAYMENT ?? "$0.05" });
registerExactSvmScheme(client, {
  signer: await createKeyPairSignerFromBytes(base58.decode(key)),
});

const httpClient = new x402HTTPClient(client);
const baseArguments = ARGUMENTS[TOOL] ?? {};

// 1. Unpaid call: the result carries the quote.
const quoted = await callTool(baseArguments);
const answer = JSON.parse(quoted.content[0].text);

if (!answer.payment_required) {
  console.log("No payment was asked for. Response:");
  console.log(JSON.stringify(answer, null, 2).slice(0, 800));
  process.exit(0);
}

const accepted = answer.quote.accepts[0];
console.log(`quote: ${accepted.amount} base units of ${accepted.asset} on ${accepted.network}`);

// 2. Sign it, exactly as a client does for an HTTP 402.
const payload = await httpClient.createPaymentPayload(answer.quote);
const { "PAYMENT-SIGNATURE": signature } = httpClient.encodePaymentSignatureHeader(payload);

// 3. Call again, paying.
const started = Date.now();
const paid = await callTool({ ...baseArguments, x_payment: signature });
const seconds = ((Date.now() - started) / 1000).toFixed(2);

if (paid.isError) {
  console.log(`paid call failed after ${seconds}s:\n${paid.content[0].text.slice(0, 500)}`);
  process.exit(1);
}

const data = JSON.parse(paid.content[0].text).data;
console.log(`${TOOL} answered in ${seconds}s`);
console.log(Array.isArray(data) ? `${data.length} items` : "one object");
console.log(JSON.stringify(Array.isArray(data) ? data[0] : data, null, 2).slice(0, 900));
