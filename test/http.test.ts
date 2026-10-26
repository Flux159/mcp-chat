import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer, Server } from "node:http";
import { AddressInfo } from "node:net";
import { MCPClient } from "../src/interactive.js";
import pkg from "../package.json";

const { createMessage } = vi.hoisted(() => ({ createMessage: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  Anthropic: class {
    messages = { create: createMessage };
  },
}));

async function* toolCall(name: string, input: object) {
  yield {
    type: "content_block_start",
    content_block: { type: "tool_use", id: name, name, input: {} },
  };
  yield {
    type: "content_block_delta",
    delta: { type: "input_json_delta", partial_json: JSON.stringify(input) },
  };
  yield { type: "content_block_stop" };
}

let server: Server;
let client: MCPClient;
afterEach(async () => {
  await client?.cleanup();
  if (server)
    await new Promise<void>((resolve) => server.close(() => resolve()));
  vi.resetAllMocks();
});

describe("Streamable HTTP servers", () => {
  it("discovers tools and returns tool output through the chat caller with a project User-Agent", async () => {
    const requests: { method: string; params: any; userAgent?: string }[] = [];
    server = createServer(async (req, res) => {
      if (req.method !== "POST") {
        res.writeHead(405).end();
        return;
      }
      let body = "";
      for await (const chunk of req) body += chunk;
      const message = JSON.parse(body);
      requests.push({ ...message, userAgent: req.headers["user-agent"] });
      if (message.id === undefined) {
        res.writeHead(202).end();
        return;
      }
      let result;
      if (message.method === "initialize") {
        result = {
          protocolVersion: message.params.protocolVersion,
          capabilities: { tools: {} },
          serverInfo: { name: "test-search", version: "1.0.0" },
        };
      } else if (message.method === "tools/list") {
        result = {
          tools: ["web_search", "web_fetch"].map((name) => ({
            name,
            inputSchema: { type: "object", properties: {} },
          })),
        };
      } else if (message.method === "tools/call") {
        result = {
          content: [
            {
              type: "text",
              text: `${message.params.name}: MCP specification https://modelcontextprotocol.io`,
            },
          ],
        };
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const port = (server.address() as AddressInfo).port;
    client = new MCPClient();
    // The URL must take precedence over command/script substring detection.
    await client.connectToServer(`http://127.0.0.1:${port}/npx.js`);
    createMessage
      .mockResolvedValueOnce(
        toolCall("web_search", { search_queries: ["MCP specification"] }),
      )
      .mockResolvedValueOnce(
        toolCall("web_fetch", { urls: ["https://modelcontextprotocol.io"] }),
      )
      .mockResolvedValueOnce((async function* () {})());
    let output = "";
    await client.processQueryStream("Find the MCP specification", (token) => {
      output += token;
    });
    expect(
      createMessage.mock.calls[0][0].tools.map((tool: any) => tool.name),
    ).toEqual(["web_search", "web_fetch"]);
    expect(
      requests
        .filter((r) => r.method === "tools/call")
        .map((r) => r.params.name),
    ).toEqual(["web_search", "web_fetch"]);
    expect(output).toContain("web_search: MCP specification");
    expect(output).toContain("web_fetch: MCP specification");
    expect(
      requests.every((r) => r.userAgent === `mcp-chat/${pkg.version}`),
    ).toBe(true);
  });
});
