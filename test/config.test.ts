import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { getDefaultConfigPath, parseConfigFile } from "../src/index.js";

// Mock fs and os modules
vi.mock("fs/promises");
vi.mock("os", () => ({
  default: {
    homedir: vi.fn().mockReturnValue("/home/testuser"),
    platform: vi.fn().mockReturnValue("darwin"),
  },
  homedir: vi.fn().mockReturnValue("/home/testuser"),
  platform: vi.fn().mockReturnValue("darwin"),
}));

// Mock MCPClient class
vi.mock("../src/interactive.js", async () => {
  const actual = await vi.importActual("../src/interactive.js");
  return {
    ...actual,
    startInteractiveChat: vi.fn().mockResolvedValue(undefined),
    MCPClient: class {
      ensureDirectories = vi.fn().mockResolvedValue(undefined);
      loadHistory = vi.fn().mockResolvedValue(undefined);
      saveHistory = vi.fn().mockResolvedValue(undefined);
      loadChatFile = vi.fn().mockResolvedValue(undefined);
      saveChatFile = vi.fn().mockResolvedValue(undefined);
      connectToServer = vi.fn().mockResolvedValue(undefined);
      processQuery = vi.fn().mockResolvedValue("");
      processQueryStream = vi.fn().mockResolvedValue(undefined);
      handleSpecialCommand = vi.fn().mockResolvedValue(false);
      chatLoop = vi.fn().mockResolvedValue(undefined);
      cleanup = vi.fn().mockResolvedValue(undefined);
      messageHistory = [];
      tools = [];
      currentChatFile = null;
      rl = null;
      commandHistory = [];
      model = "claude-3-5-sonnet-20241022";
    },
  };
});

describe("Claude Config Parsing", () => {
  const mockConfig = {
    mcpServers: {
      kubernetes: {
        command: "npx",
        args: ["mcp-server-kubernetes"],
      },
      filesystem: {
        command: "npx",
        args: [
          "-y",
          "@modelcontextprotocol/server-filesystem",
          "/Users/suyogsonwalkar/ClaudeProjects/",
        ],
      },
    },
  };

  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks();

    // Mock os.homedir()
    vi.mocked(os.homedir).mockReturnValue("/home/testuser");

    // Mock process.env.APPDATA for Windows tests
    process.env.APPDATA = "C:\\Users\\testuser\\AppData\\Roaming";

    // Mock console.error to suppress expected error messages
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Restore console.error
    vi.restoreAllMocks();
  });

  describe("getDefaultConfigPath", () => {
    it("should return correct path for macOS", () => {
      vi.mocked(os.platform).mockReturnValue("darwin");
      const expectedPath = path.join(
        "/home/testuser",
        "Library",
        "Application Support",
        "Claude",
        "claude_desktop_config.json"
      );
      expect(getDefaultConfigPath()).toBe(expectedPath);
    });

    it("should return correct path for Windows", () => {
      vi.mocked(os.platform).mockReturnValue("win32");
      const expectedPath = path.join(
        "C:\\Users\\testuser\\AppData\\Roaming",
        "Claude",
        "claude_desktop_config.json"
      );
      expect(getDefaultConfigPath()).toBe(expectedPath);
    });

    it("should throw error for unsupported platform", () => {
      vi.mocked(os.platform).mockReturnValue("linux");
      expect(() => getDefaultConfigPath()).toThrow(
        "Unsupported platform: linux"
      );
    });
  });

  describe("parseConfigFile", () => {
    it("should parse valid config file correctly", async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const servers = await parseConfigFile("test-config.json");
      expect(servers).toEqual([
        "npx mcp-server-kubernetes",
        "npx -y @modelcontextprotocol/server-filesystem /Users/suyogsonwalkar/ClaudeProjects/",
      ]);
    });

    it("should handle empty config file", async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ mcpServers: {} })
      );

      const servers = await parseConfigFile("empty-config.json");
      expect(servers).toEqual([]);
    });

    it("should handle invalid JSON", async () => {
      vi.mocked(fs.readFile).mockResolvedValue("invalid json");

      const servers = await parseConfigFile("invalid-config.json");
      expect(servers).toEqual([]);
    });

    it("should handle file read error", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));

      const servers = await parseConfigFile("nonexistent-config.json");
      expect(servers).toEqual([]);
    });

    it("should handle missing mcpServers field", async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({}));

      const servers = await parseConfigFile("missing-servers-config.json");
      expect(servers).toEqual([]);
    });
  });
});
