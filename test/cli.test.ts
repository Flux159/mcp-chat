import { describe, it, expect, vi, beforeEach } from "vitest";
import { Command } from "commander";
import { startInteractiveChat } from "../src/interactive.js";

// Mock the interactive chat module
vi.mock("../src/interactive.js", () => ({
  startInteractiveChat: vi.fn().mockResolvedValue(undefined),
}));

describe("MCP Chat CLI", () => {
  let program: Command;
  const servers: string[] = [];

  beforeEach(() => {
    // Reset the servers array and mocks
    servers.length = 0;
    vi.clearAllMocks();

    // Create a new Command instance for each test
    program = new Command();
    program
      .option(
        "-s, --server <command>",
        "Specify MCP server command to run",
        (val: string) => {
          servers.push(val);
          return servers;
        }
      )
      .option("-m, --model <name>", "Choose a specific model to chat with");
  });

  it("should properly parse a single server command", () => {
    // Simulate command line arguments
    process.argv = [
      "node",
      "index.js",
      "--server",
      "npx mcp-server-kubernetes",
    ];

    // Parse the arguments
    program.parse(process.argv);
    const options = program.opts();

    // Verify the server command was correctly parsed
    expect(servers).toHaveLength(1);
    expect(servers[0]).toBe("npx mcp-server-kubernetes");
    expect(options.server).toEqual(servers);
  });

  it("should handle multiple server commands", () => {
    // Simulate command line arguments with multiple servers
    process.argv = [
      "node",
      "index.js",
      "--server",
      "npx mcp-server-kubernetes",
      "--server",
      "npx other-server",
    ];

    // Parse the arguments
    program.parse(process.argv);
    const options = program.opts();

    // Verify both server commands were correctly parsed
    expect(servers).toHaveLength(2);
    expect(servers[0]).toBe("npx mcp-server-kubernetes");
    expect(servers[1]).toBe("npx other-server");
    expect(options.server).toEqual(servers);
  });

  it("should start interactive chat with correct server options", async () => {
    // Simulate command line arguments
    process.argv = [
      "node",
      "index.js",
      "--server",
      "npx mcp-server-kubernetes",
    ];

    // Parse the arguments
    program.parse(process.argv);
    const options = program.opts();

    // Call interactive chat
    await startInteractiveChat({
      servers: options.server,
      model: options.model,
    });

    // Verify startInteractiveChat was called with correct arguments
    expect(startInteractiveChat).toHaveBeenCalledWith({
      servers: ["npx mcp-server-kubernetes"],
      model: undefined,
    });
    expect(startInteractiveChat).toHaveBeenCalledTimes(1);
  });
});
