// The tool surface: an agent picks a tool from its name, description and
// price, so those are worth pinning.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TOOLS } from "../src/tools.js";
import { createServer } from "../src/server.js";

test("every Cookin endpoint is exposed once", () => {
  const names = TOOLS.map((tool) => tool.name);

  assert.deepEqual(
    [...names].sort(),
    [
      "deployer_history",
      "list_agent_buys",
      "list_graduated_tokens",
      "list_new_tokens",
      "list_pumping_tokens",
      "profile_wallet",
      "scan_token",
      "token_trades",
    ],
    "tool list changed",
  );
  assert.equal(new Set(names).size, names.length, "duplicate tool name");
});

test("each tool names its price and what it returns", () => {
  for (const tool of TOOLS) {
    assert.match(tool.price, /^\$0\.\d{2}$/, `${tool.name}: odd price`);
    assert.ok(tool.description.length > 80, `${tool.name}: description too thin`);
    assert.ok(tool.title.length > 0, `${tool.name}: no title`);
  }
});

test("paths are built from the arguments, query included", () => {
  const path = (name: string, args: Record<string, unknown>) =>
    TOOLS.find((tool) => tool.name === name)!.request(args);

  assert.equal(path("scan_token", { mint: "MintAbc" }), "/v1/tokens/MintAbc");
  assert.equal(
    path("scan_token", { mint: "MintAbc", fields: "score,ratings" }),
    "/v1/tokens/MintAbc?fields=score,ratings",
  );
  assert.equal(path("token_trades", { mint: "MintAbc" }), "/v1/tokens/MintAbc/trades");
  assert.equal(path("list_agent_buys", {}), "/v1/tokens/agents");
  assert.equal(path("profile_wallet", { address: "WalletAbc" }), "/v1/traders/WalletAbc");
  assert.equal(
    path("deployer_history", { address: "WalletAbc", limit: 10 }),
    "/v1/devs/WalletAbc/tokens?limit=10",
  );
  assert.equal(path("deployer_history", { address: "WalletAbc" }), "/v1/devs/WalletAbc/tokens");
});

test("a tool returns the API body, and a failure comes back as an error", async () => {
  const calls: string[] = [];
  const server = createServer(
    {
      mode: "pro-key",
      get: async (path) => {
        calls.push(path);
        if (path.includes("Broken")) throw new Error("Cookin API returned 500: nope");
        return { data: { mint: "MintAbc" } };
      },
    },
    "0.0.0-test",
  );

  // `registerTool` keeps each tool's handler on the server; reach it
  // through the registered tool map, as the SDK's own tests do.
  const registered = (server as unknown as { _registeredTools: Record<string, any> })
    ._registeredTools;

  const ok = await registered.scan_token.handler({ mint: "MintAbc" }, {});
  assert.equal(calls.at(-1), "/v1/tokens/MintAbc");
  assert.match(ok.content[0].text, /"mint": "MintAbc"/);
  assert.notEqual(ok.isError, true);

  const failed = await registered.scan_token.handler({ mint: "Broken" }, {});
  assert.equal(failed.isError, true);
  assert.match(failed.content[0].text, /returned 500/);
});

test("the price appears in the description an agent reads", () => {
  const server = createServer({ mode: "x402", get: async () => ({}) }, "0.0.0-test");
  const registered = (server as unknown as { _registeredTools: Record<string, any> })
    ._registeredTools;

  assert.match(registered.scan_token.description, /\$0\.02/);
  assert.match(registered.scan_token.description, /paid from your Solana wallet/);
});
