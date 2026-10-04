# @cookinfun/mcp

MCP server for the [Cookin API](https://cookin.fun/api): Solana and Pump.fun
token intelligence for agents. Ask it who is behind a token before entering,
while holding, or after exiting.

Eight tools, paid per call in USDC over
[x402](https://cookin.fun/api/x402) with no account, or covered by a Cookin Pro
key.

## What it answers

- **Coordinated wallets.** Which wallets act as one group (bundles), how much
  supply they hold, and how many of those groups are heavy net sellers.
- **Holder quality.** Share of supply held by wallets that historically pick
  winners, by quick sellers, by suspicious wallets, and by wallets that nuke
  charts when they exit.
- **KOL positions.** Which tracked KOL wallets hold, and how much.
- **Wallet reputation.** One wallet's lifetime PnL, ROI, win rate, hold times,
  and smart-money classification.
- **Deployer history.** Every token a deployer launched, its bond rate, and a
  survival curve across market cap rungs.
- **Ratings.** A green, yellow, red or neutral verdict per metric, using the
  same thresholds as the Cookin UI.

## Install

### Claude Desktop

Add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cookin": {
      "command": "npx",
      "args": ["-y", "@cookinfun/mcp"],
      "env": { "SOLANA_KEY": "<base58 Solana keypair holding USDC>" }
    }
  }
}
```

### Cursor

In `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "cookin": {
      "command": "npx",
      "args": ["-y", "@cookinfun/mcp"],
      "env": { "COOKIN_API_KEY": "<Cookin Pro key>" }
    }
  }
}
```

### Anything else that speaks MCP

```bash
SOLANA_KEY=<base58 keypair> npx -y @cookinfun/mcp
```

## Paying

Pick one. The server prints which mode it started in, on stderr.

| Environment | Mode | Cost |
|---|---|---|
| `SOLANA_KEY` | Pay per call with x402 | $0.01 per call, $0.02 for a full token snapshot |
| `COOKIN_API_KEY` | Cookin Pro | 1 SOL per 30 days, 600 requests per minute |
| neither | Unpaid | Every call returns 402 and says how to pay |

`SOLANA_KEY` is a base58-encoded 64-byte Solana keypair. The wallet needs USDC
only: the facilitator pays the network fee, and a call that errors is never
charged. Mint a Pro key at
[cookin.fun/account/api-keys](https://cookin.fun/account/api-keys).

Optional:

- `COOKIN_MAX_PAYMENT` caps what one call may pay. Default `$0.05`.
- `COOKIN_BASE_URL` points at another host. Default `https://api.cookin.fun`.

## Tools

| Tool | Price | Returns |
|---|---|---|
| `scan_token` | $0.02 | Full snapshot for one mint: score, holders, bundles, KOLs, cohorts, signals, ratings |
| `token_trades` | $0.01 | Recent trades, each with the trader's history at that moment |
| `list_new_tokens` | $0.01 | New launches that passed the rug filters |
| `list_pumping_tokens` | $0.01 | Tokens currently pumping |
| `list_graduated_tokens` | $0.01 | Recent graduates |
| `list_agent_buys` | $0.01 | What the top Cookin agents bought most recently |
| `profile_wallet` | $0.01 | One wallet's lifetime trading profile |
| `deployer_history` | $0.01 | Every token one deployer launched |

Spend less: start with one `scan_token`, and stop if its ratings already answer
the question. `fields` trims a snapshot at the same price. Deployer history
changes slowly, so cache it.

## Remote endpoint

The same tools are served remotely at `https://api.cookin.fun/mcp`, with
nothing to install. Point an MCP host at that URL. A tool call with no
payment returns the x402 quote in its result; sign it and call again
with the payment in the `x_payment` argument, or send a Pro key in the
`Authorization` header.

Use the local package instead when you want the server to hold the
wallet and pay for calls by itself.

## Reference

- Field-by-field reference: [api.cookin.fun/skill.md](https://api.cookin.fun/skill.md)
- OpenAPI spec: [api.cookin.fun/openapi.json](https://api.cookin.fun/openapi.json)
- Docs: [cookin.fun/api](https://cookin.fun/api)

## Development

```bash
npm install
npm test          # unit tests, no network
npm run build     # tsc to dist/
npm start         # run the server over stdio
```

### Releasing

`package.json` and `server.json` both carry the version, and the MCP
Registry rejects a mismatch. Bump both, publish to npm first (the
registry reads `mcpName` from the published package), then publish the
metadata:

```bash
npm publish --access public
mcp-publisher login github
mcp-publisher publish
```

MIT
