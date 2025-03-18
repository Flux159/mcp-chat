import { describe, it, expect, vi, beforeEach } from "vitest";
import { Command } from "commander";
import { startInteractiveChat, runPrompt } from "../src/interactive.js";
import { setupProgram } from "../src/index.js";

// Mock the interactive chat module
vi.mock("../src/interactive.js", () => ({
  startInteractiveChat: vi.fn().mockResolvedValue(undefined),
  runPrompt: vi.fn().mockResolvedValue(undefined),
}));

describe("MCP Chat CLI", () => {
  beforeEach(() => {
    // Reset the mocks
    vi.clearAllMocks();
  });

  it("should properly parse a single server command", () => {
    // Simulate command line arguments
    const argv = ["node", "index.js", "--server", "npx mcp-server-kubernetes"];

    // Parse the arguments
    const options = setupProgram(argv);

    // Verify the server command was correctly parsed
    expect(options.server).toHaveLength(1);
    expect(options.server![0]).toBe("npx mcp-server-kubernetes");
  });

  it("should handle multiple server commands", () => {
    // Simulate command line arguments with multiple servers
    const argv = [
      "node",
      "index.js",
      "--server",
      "npx mcp-server-kubernetes",
      "--server",
      "npx other-server",
    ];

    // Parse the arguments
    const options = setupProgram(argv);

    // Verify both server commands were correctly parsed
    expect(options.server).toHaveLength(2);
    expect(options.server![0]).toBe("npx mcp-server-kubernetes");
    expect(options.server![1]).toBe("npx other-server");
  });

  it("should start interactive chat with correct server options", async () => {
    // Simulate command line arguments
    const argv = ["node", "index.js", "--server", "npx mcp-server-kubernetes"];

    // Parse the arguments
    const options = setupProgram(argv);

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

  it("should run prompt mode with correct options", async () => {
    // Simulate command line arguments with prompt
    const argv = [
      "node",
      "index.js",
      "--server",
      "npx mcp-server-kubernetes",
      "-m",
      "claude-3-opus-20240229",
      "-p",
      "List my pods",
    ];

    // Parse the arguments
    const options = setupProgram(argv);

    // Call runPrompt
    await runPrompt({
      servers: options.server,
      model: options.model,
      prompt: options.prompt!,
    });

    // Verify runPrompt was called with correct arguments
    expect(runPrompt).toHaveBeenCalledWith({
      servers: ["npx mcp-server-kubernetes"],
      model: "claude-3-opus-20240229",
      prompt: "List my pods",
    });
    expect(runPrompt).toHaveBeenCalledTimes(1);
    expect(startInteractiveChat).not.toHaveBeenCalled();
  });
});
