#!/usr/bin/env node

import { config } from "dotenv";
config(); // load environment variables from .env

import { Command } from "commander";
import pkg from "../package.json" with { type: "json" }; // Note that for prettier you may need to remove this & use the line below because prettier can't parse the `with` keyword
// const pkg = require("../package.json");
import { startInteractiveChat, runPrompt } from "./interactive.js";


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
    );

  program.parse(argv);

  const options = program.opts() as ProgramOptions;
  options.server = servers; // Use our collected servers

  return options;
}

interface ProgramOptions {
  server?: string[];
  config?: string;
  prompt?: string;
  model?: string;
  agent?: boolean;
  eval?: string;
}

const options = setupProgram(process.argv);

async function main() {
  try {
    // Default interactive mode if no specific mode is selected
    // console.log(options);

    if (!options.prompt && !options.eval) {
      await startInteractiveChat({
        servers: options.server,
        configPath: options.config,
        model: options.model,
      });
    } else {
      // Handle single prompt mode
      if (options.prompt) {
        console.log(`Running prompt: ${options.prompt}`);
        await runPrompt({
          servers: options.server,
          configPath: options.config,
          model: options.model,
          prompt: options.prompt,
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
