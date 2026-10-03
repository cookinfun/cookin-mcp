#!/usr/bin/env node
// Entry point: serves the Cookin tools over stdio, the transport every
// MCP host (Claude Desktop, Cursor, OpenClaw) speaks.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "./client.js";
import { createServer } from "./server.js";

const VERSION = "0.1.0";

const client = await createClient();
const server = createServer(client, VERSION);

// stdout carries the protocol, so every human-readable line goes to
// stderr or it would corrupt the stream.
process.stderr.write(`cookin-mcp ${VERSION} ready (payment: ${client.mode})\n`);

await server.connect(new StdioServerTransport());
