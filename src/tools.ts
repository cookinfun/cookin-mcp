// The Cookin endpoints this server exposes, one entry per MCP tool.
//
// Each entry carries what an agent needs to choose the tool (title,
// description, price) and what the server needs to call it (the path
// builder and the input schema). Prices are the published ones; the
// live list is always at https://api.cookin.fun/openapi.json.
import { z } from "zod";

const mint = z
  .string()
  .describe("Solana token mint address, base58.");

const wallet = z
  .string()
  .describe("Solana wallet address, base58.");

export type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  price: string;
  inputSchema: z.ZodRawShape;
  /** Path and query for one call, from the validated arguments. */
  request: (args: Record<string, unknown>) => string;
};

export const TOOLS: ToolDefinition[] = [
  {
    name: "scan_token",
    title: "Scan one token",
    description:
      "Full Cookin snapshot for one Solana or Pump.fun token: quality score, " +
      "holders, bundles (coordinated wallets), KOL positions, holder behavior " +
      "cohorts, pump/dump signals, and a green/yellow/red rating per metric. " +
      "The first call to make about a token, at any stage of its life.",
    price: "$0.02",
    inputSchema: {
      mint,
      fields: z
        .string()
        .optional()
        .describe(
          "Comma-separated groups to return, for a smaller response at the same " +
            "price: meta, status, market, holders, bundles, score, cohorts, kols, " +
            "signals, ratings. Omit for all of them.",
        ),
    },
    request: (args) =>
      `/v1/tokens/${args.mint}` + (args.fields ? `?fields=${args.fields}` : ""),
  },
  {
    name: "token_trades",
    title: "Recent trades for one token",
    description:
      "Recent trades for one token, each carrying the trader's history as it " +
      "stood at that moment: PnL, win rate, bundle membership, smart-money flag. " +
      "Use it to see who is buying or selling right now.",
    price: "$0.01",
    inputSchema: { mint },
    request: (args) => `/v1/tokens/${args.mint}/trades`,
  },
  {
    name: "list_new_tokens",
    title: "New launches",
    description:
      "Newly launched Pump.fun tokens that passed Cookin's rug filters, with " +
      "quality signals and ratings. Use it to find candidates.",
    price: "$0.01",
    inputSchema: {},
    request: () => "/v1/tokens/new",
  },
  {
    name: "list_pumping_tokens",
    title: "Pumping tokens",
    description:
      "Pump.fun tokens currently pumping, with quality signals, holder behavior, " +
      "and ratings.",
    price: "$0.01",
    inputSchema: {},
    request: () => "/v1/tokens/pumps",
  },
  {
    name: "list_graduated_tokens",
    title: "Recent graduates",
    description:
      "Pump.fun tokens that recently graduated to Raydium or PumpSwap, with " +
      "quality signals and ratings.",
    price: "$0.01",
    inputSchema: {},
    request: () => "/v1/tokens/graduated",
  },
  {
    name: "list_agent_buys",
    title: "What the top agents bought",
    description:
      "Tokens the top Cookin trading agents bought most recently, with quality " +
      "signals. The most-bought Cookin endpoint: it answers what proven " +
      "strategies are doing right now.",
    price: "$0.01",
    inputSchema: {},
    request: () => "/v1/tokens/agents",
  },
  {
    name: "profile_wallet",
    title: "Wallet trading profile",
    description:
      "Lifetime trading profile of one Solana wallet: PnL, ROI, win rate, hold " +
      "times, bundle and smart-money flags, recent tokens traded. Use it to judge " +
      "a buyer or seller you saw in a trade list.",
    price: "$0.01",
    inputSchema: { address: wallet },
    request: (args) => `/v1/traders/${args.address}`,
  },
  {
    name: "deployer_history",
    title: "Deployer launch history",
    description:
      "Every token one deployer has launched, with its bond rate, peak market " +
      "caps, and a survival curve across market cap rungs. Changes slowly, so " +
      "cache the answer.",
    price: "$0.01",
    inputSchema: {
      address: wallet.describe("Deployer wallet address, base58."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Tokens per page, 1 to 100. Default 50."),
      offset: z.number().int().min(0).optional().describe("Tokens to skip. Default 0."),
    },
    request: (args) => {
      const query = new URLSearchParams();
      if (args.limit !== undefined) query.set("limit", String(args.limit));
      if (args.offset !== undefined) query.set("offset", String(args.offset));
      const suffix = query.size > 0 ? `?${query}` : "";
      return `/v1/devs/${args.address}/tokens${suffix}`;
    },
  },
];
