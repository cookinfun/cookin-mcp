// The MCP server: one tool per Cookin endpoint.
//
// Every tool returns the API's JSON body as text, unchanged, so the
// model sees exactly the documented shape (`data` plus `meta`). A
// failure comes back as an error result carrying Cookin's own message,
// which on a 402 explains how to pay.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CookinClient } from "./client.js";
import { TOOLS } from "./tools.js";

export const SERVER_NAME = "cookin";

export function createServer(client: CookinClient, version: string): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version });

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        // The price belongs in the description: an agent choosing
        // between tools is also choosing what to spend.
        description: `${tool.description} Costs ${tool.price} per call (${describe(client.mode)}).`,
        inputSchema: tool.inputSchema,
      },
      async (args: Record<string, unknown>) => {
        try {
          const data = await client.get(tool.request(args ?? {}));
          return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text", text: (error as Error).message }],
          };
        }
      },
    );
  }

  return server;
}

function describe(mode: CookinClient["mode"]): string {
  switch (mode) {
    case "pro-key":
      return "covered by your Pro subscription";
    case "x402":
      return "paid from your Solana wallet in USDC";
    case "unpaid":
      return "no payment configured, calls will return 402";
  }
}
