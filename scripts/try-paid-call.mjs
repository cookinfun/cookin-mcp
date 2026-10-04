// Drives the local MCP server the way Claude Desktop or Cursor would,
// and makes one real call. Development only: it is not published to npm.
//
// Usage:
//   npm run build
//   SOLANA_KEY=<base58 keypair> node scripts/try-paid-call.mjs [tool]
//   COOKIN_API_KEY=<pro key>    node scripts/try-paid-call.mjs [tool]
//
// With neither set, the call comes back as a 402, which is also worth
// seeing. `tool` defaults to list_agent_buys, the cheapest route at
// $0.01. Pass scan_token to buy a full snapshot for $0.02.
//
// The key stays in this process and in the server it starts, both on
// this machine. Only a signed transaction goes out.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const TOOL = process.argv[2] ?? "list_agent_buys";

// A mint to scan when the tool needs one. Override with MINT=...
const MINT = process.env.MINT ?? "43iKyXWTgkJFDoTpsXVnuAyGhmzCjcLTZQRrVzfrpump";

const ARGUMENTS = {
  scan_token: { mint: MINT, fields: "meta,score,bundles,ratings" },
  token_trades: { mint: MINT },
  profile_wallet: { address: process.env.WALLET ?? MINT },
  deployer_history: { address: process.env.WALLET ?? MINT, limit: 5 },
};

const client = new Client({ name: "cookin-mcp-try", version: "0" });

await client.connect(
  new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
    // Only what the server needs: PATH to run, plus whichever payment
    // credential is set in this shell.
    env: {
      PATH: process.env.PATH,
      ...(process.env.SOLANA_KEY ? { SOLANA_KEY: process.env.SOLANA_KEY } : {}),
      ...(process.env.COOKIN_API_KEY ? { COOKIN_API_KEY: process.env.COOKIN_API_KEY } : {}),
      ...(process.env.COOKIN_MAX_PAYMENT
        ? { COOKIN_MAX_PAYMENT: process.env.COOKIN_MAX_PAYMENT }
        : {}),
    },
  }),
);

const { tools } = await client.listTools();
console.log(`${tools.length} tools available\n`);

const started = Date.now();
const result = await client.callTool({ name: TOOL, arguments: ARGUMENTS[TOOL] ?? {} });
const seconds = ((Date.now() - started) / 1000).toFixed(2);

const text = result.content?.[0]?.text ?? "(no content)";

if (result.isError) {
  console.log(`${TOOL} failed after ${seconds}s:\n${text}`);
} else {
  const body = JSON.parse(text);
  const data = body.data;
  console.log(`${TOOL} answered in ${seconds}s`);

  if (Array.isArray(data)) {
    console.log(`${data.length} items`);
    // An empty list is a real answer, not a crash: the lists are
    // filtered, so a quiet minute returns nothing.
    if (data.length === 0) console.log("(nothing in the list right now)");
    else console.log(JSON.stringify(data[0], null, 2).slice(0, 1200));
  } else {
    console.log(JSON.stringify(data ?? body, null, 2).slice(0, 1200));
  }
}

await client.close();
