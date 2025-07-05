#!/usr/bin/env node

import { config } from "dotenv";
import { Command } from "commander";
import pkg from "../package.json" with { type: "json" };
import { startInteractiveChat, runPrompt } from "./interactive.js";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { DEFAULT_SYSTEM_PROMPT } from "./constants.js";
import { createDevServer } from "./devserver.js";

config(); // load environment variables from .env

function getDefaultConfigPaths() {
  return {
    darwin: path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json"
    ),
    win32: path.join(
      process.env.APPDATA || "",
      "Claude",
      "claude_desktop_config.json"
    ),
  };
}

interface MCPServerConfig {
  command: string;
  args: string[];
}

interface ClaudeDesktopConfig {
  mcpServers: {
    [key: string]: MCPServerConfig;
  };
}

export function getDefaultConfigPath(): string {
  const platform = os.platform();
  const configPaths = getDefaultConfigPaths();
  const configPath = configPaths[platform as keyof typeof configPaths];
  if (!configPath) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  return configPath;
}

export async function parseConfigFile(configPath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(content) as ClaudeDesktopConfig;

    const servers: string[] = [];
    for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
      // Convert the config to our server format
      const serverString = [serverConfig.command, ...serverConfig.args].join(
        " "
      );
      servers.push(serverString);
    }
    return servers;
  } catch (error) {
    console.error(`Failed to parse config file ${configPath}:`, error);
    return [];
  }
}

export function setupProgram(argv?: readonly string[]): ProgramOptions {
  const program = new Command();

  const servers: string[] = [];
  program
    .name("mcp-chat")
    .description(
      "Open Source Generic MCP Client for testing & evaluating mcp servers and agents"
    )
    .version(pkg.version)
    .option("-c, --config <path>", "Path to claude_desktop_config.json")
    .option("-p, --prompt <text>", "Run a single prompt and exit")
    .option("-m, --model <name>", "Choose a specific model to chat with")
    .option("-a, --agent", "Run in agent mode")
    .option("-e, --eval <path>", "Run evaluation mode with specified JSON file")
    .option(
      "-s, --server <command>",
      "Specify MCP server command to run",
      (val: string) => {
        servers.push(val);
        return servers;
      }
    )
    .option(
      "--system <system_prompt>",
      "Specify a custom system prompt to run."
    )
    .option(
      "--chat <file>",
      "Load and continue a previous chat session from a JSON file"
    )
    .option(
      "--web [port]",
      "Start the web development server with optional port",
      (val) => {
        if (val === undefined) return true;
        const port = parseInt(val, 10);
        if (isNaN(port)) {
          throw new Error("Port must be a number");
        }
        return port;
      }
    );

  program.parse(argv);

  const options = program.opts() as ProgramOptions;
  options.server = servers;

  return options;
}

interface ProgramOptions {
  server?: string[];
  config?: string;
  prompt?: string;
  model?: string;
  agent?: boolean;
  eval?: string;
  chat?: string;
  system?: string;
  web?: number | boolean;
}

const options = setupProgram(process.argv);

async function main() {
  try {
    if (options.web) {
      const port = typeof options.web === "number" ? options.web : undefined;
      await createDevServer(port);
      return;
    }

    let servers = options.server || [];

    // If configPath is "default" or a specific path is provided, parse it
    if (options.config) {
      const configPath =
        options.config === "default" ? getDefaultConfigPath() : options.config;

      const configServers = await parseConfigFile(configPath);
      servers = [...servers, ...configServers];
    }

    // Default interactive mode if no specific mode is selected
    if (!options.prompt && !options.eval) {
      await startInteractiveChat({
        servers,
        model: options.model,
        chatFile: options.chat,
        systemPrompt: options.system || DEFAULT_SYSTEM_PROMPT,
      });
    } else {
      // Handle single prompt mode
      if (options.prompt) {
        console.log(`Running prompt: ${options.prompt}`);
        await runPrompt({
          servers,
          model: options.model,
          prompt: options.prompt,
          chatFile: options.chat,
          systemPrompt: options.system || DEFAULT_SYSTEM_PROMPT,
        });
      }

      // Handle eval mode
      if (options.eval) {
        console.log(`Running evaluation with file: ${options.eval}`);
        // TODO: Implement evaluation mode
      }
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
