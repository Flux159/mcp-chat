import { Anthropic } from "@anthropic-ai/sdk";
import {
  MessageParam,
  Tool,
  ToolResultBlockParam,
  ToolUseBlockParam,
  MessageStreamEvent,
  ContentBlockDeltaEvent,
  ContentBlockStartEvent,
  ContentBlockStopEvent,
} from "@anthropic-ai/sdk/resources/messages/messages.mjs";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import readline from "readline/promises";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { Stream } from "@anthropic-ai/sdk/streaming.mjs";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY is not set");
}

const MAX_TOKENS = 4096;
const GREEN = "\x1b[32m";
const BLUE = "\x1b[34m";
const RESET = "\x1b[0m";

function getMCPChatDir(): string {
  return path.join(os.homedir(), ".mcpchat");
}

function getHistoryFile(): string {
  return path.join(getMCPChatDir(), "history");
}

function getChatsDir(): string {
  return path.join(getMCPChatDir(), "chats");
}

interface ChatOptions {
  servers?: string[];
  model?: string;
  chatFile?: string;
  systemPrompt?: string;
}

export class MCPClient {
  private mcp: Client;
  private anthropic: Anthropic;
  private transport: StdioClientTransport | null = null;
  private tools: Tool[] = [];
  private messageHistory: MessageParam[] = [];
  private rl: readline.Interface | null = null;
  private commandHistory: string[] = [];
  private currentChatFile: string | null = null;
  public model: string;
  public systemPrompt: string | undefined;

  constructor(private options: ChatOptions = {}) {
    this.model = options.model || "claude-3-5-sonnet-20241022";
    this.systemPrompt = options.systemPrompt;

    // Initialize Anthropic client and MCP client
    this.anthropic = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
    });
    this.mcp = new Client({ name: "mcp-client-cli", version: "1.0.0" });
  }

  public async ensureDirectories(): Promise<void> {
    try {
      // Create .mcpchat directory if it doesn't exist
      await fs.mkdir(getMCPChatDir(), { recursive: true });
      // Create chats subdirectory if it doesn't exist
      await fs.mkdir(getChatsDir(), { recursive: true });
    } catch (error) {
      console.error("Failed to create directories:", error);
      throw error;
    }
  }

  private async loadHistory(): Promise<void> {
    try {
      await this.ensureDirectories();
      const historyContent = await fs.readFile(getHistoryFile(), "utf-8");
      this.commandHistory = historyContent.split("\n").filter(Boolean);
    } catch (error) {
      // File doesn't exist or is empty, that's fine
      this.commandHistory = [];
    }
  }

  private async saveHistory(): Promise<void> {
    try {
      await this.ensureDirectories();
      await fs.writeFile(
        getHistoryFile(),
        this.commandHistory.join("\n") + "\n"
      );
    } catch (error) {
      console.error("Failed to save history:", error);
    }
  }

  async loadChatFile(
    chatFile: string,
    printHistory: boolean = true
  ): Promise<void> {
    try {
      const content = await fs.readFile(chatFile, "utf-8");
      const messages = JSON.parse(content) as MessageParam[];
      this.messageHistory = messages;
      this.currentChatFile = chatFile;

      if (printHistory) {
        // Print previous messages
        console.log("\nPrevious messages:");
        for (const msg of messages) {
          if (msg.role === "user") {
            console.log("\n> " + msg.content);
          } else if (msg.role === "assistant") {
            if (Array.isArray(msg.content)) {
              // Handle tool calls
              for (const content of msg.content) {
                if (content.type === "tool_use") {
                  console.log(`\n${GREEN}[Tool Call] ${content.name}${RESET}`);
                  console.log(
                    `${GREEN}Arguments: ${JSON.stringify(
                      content.input,
                      null,
                      2
                    )}${RESET}`
                  );
                }
              }
            } else {
              console.log("\n" + msg.content);
            }
          }
        }
        console.log("\n--- Continuing chat ---\n");
      }
    } catch (error) {
      console.error("Failed to load chat file:", error);
      throw error;
    }
  }

  async saveChatFile(): Promise<void> {
    if (!this.currentChatFile) {
      // Get list of existing chat files
      const files = await fs.readdir(getChatsDir());
      const chatFiles = files.filter(
        (file) => file.startsWith("chat-") && file.endsWith(".json")
      );
      const index = chatFiles.length + 1;
      const timestamp = Date.now();
      this.currentChatFile = path.join(
        getChatsDir(),
        `chat-${index}-${timestamp}.json`
      );
    }

    try {
      await this.ensureDirectories();
      await fs.writeFile(
        this.currentChatFile,
        JSON.stringify(this.messageHistory, null, 2)
      );
    } catch (error) {
      console.error("Failed to save chat file:", error);
    }
  }

  async connectToServer(serverScriptPath: string) {
    /**
     * Connect to an MCP server
     *
     * @param serverScriptPath - Path to the server script (.py or .js)
     */
    try {
      // Determine script type and appropriate command
      const isJs = serverScriptPath.endsWith(".js");
      const isPy = serverScriptPath.endsWith(".py");
      const isDocker = serverScriptPath.includes("docker");
      const isNpx = serverScriptPath.includes("npx");
      const isUvx = serverScriptPath.includes("uvx");
      let serverWithoutCommand = serverScriptPath;
      if (isNpx) {
        const allArgs = serverScriptPath.split(" ");
        const command = allArgs[0];
        // Remove 'npx' from the beginning of args if present
        const args = command === "npx" ? allArgs.slice(1) : allArgs;

        // Initialize transport and connect to server
        this.transport = new StdioClientTransport({
          command,
          args,
        });
        this.mcp.connect(this.transport);
        serverWithoutCommand = args.join(" ");
      } else if (isUvx) {
        const allArgs = serverScriptPath.split(" ");
        const command = allArgs[0];
        // Remove 'uvx' from the beginning of args if present
        const args = command === "uvx" ? allArgs.slice(1) : allArgs;

        // Initialize transport and connect to server
        this.transport = new StdioClientTransport({
          command,
          args,
        });
        this.mcp.connect(this.transport);
        serverWithoutCommand = args.join(" ");
      } else if (isDocker) {
        const allArgs = serverScriptPath.split(" ");
        const command = allArgs[0];
        // Remove 'docker' from the beginning of args if present
        const args = command === "docker" ? allArgs.slice(1) : allArgs;

        // Initialize transport and connect to server
        this.transport = new StdioClientTransport({
          command,
          args,
        });
        this.mcp.connect(this.transport);
        serverWithoutCommand = args.join(" ");
      } else {
        if (!isJs && !isPy) {
          throw new Error("Server script must be a .js or .py file");
        }
        const command = isPy
          ? process.platform === "win32"
            ? "python"
            : "python3"
          : process.execPath;

        // Initialize transport and connect to server
        this.transport = new StdioClientTransport({
          command,
          args: [serverScriptPath],
        });
        this.mcp.connect(this.transport);
      }

      // List available tools
      const toolsResult = await this.mcp.listTools();
      this.tools = toolsResult.tools.map((tool) => {
        return {
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        };
      });
      console.log(
        `Connected to server "${serverWithoutCommand}" with tools:`,
        this.tools.map(({ name }) => name)
      );
    } catch (e) {
      console.log("Failed to connect to MCP server: ", e);
      throw e;
    }
  }

  private formatToolResult(result: any): string {
    /**
     * Format a tool result, attempting to parse and pretty print JSON if possible
     * @param result - The tool result to format
     * @returns Formatted string representation of the result
     */
    try {
      // Try to parse the first text content as JSON
      if (
        result.content &&
        Array.isArray(result.content) &&
        result.content[0]?.text
      ) {
        const parsedJson = JSON.parse(result.content[0].text);
        return JSON.stringify(parsedJson, null, 2);
      }
      // If that fails, try to parse the entire result as JSON
      const parsedJson = JSON.parse(result.content);
      return JSON.stringify(parsedJson, null, 2);
    } catch (e) {
      // If all JSON parsing fails, return the raw content
      return result.content;
    }
  }

  private async createRequest(
    stream: true
  ): Promise<Stream<Anthropic.Messages.RawMessageStreamEvent>>;
  private async createRequest(
    stream: false
  ): Promise<Anthropic.Messages.Message>;
  private async createRequest(stream: boolean = false) {
    return this.anthropic.messages.create({
      model: this.model,
      max_tokens: MAX_TOKENS,
      messages: this.messageHistory,
      tools: this.tools,
      stream,
      system: this.systemPrompt,
    });
  }

  private async handleNonStreamResponse(
    response: Anthropic.Messages.Message
  ): Promise<string> {
    const finalText = [];

    for (const content of response.content) {
      if (content.type === "text") {
        finalText.push(content.text);
        this.messageHistory.push({
          role: "assistant",
          content: content.text,
        });
      } else if (content.type === "tool_use") {
        const toolName = content.name;
        const toolArgs = content.input as { [x: string]: unknown } | undefined;

        const result = await this.mcp.callTool({
          name: toolName,
          arguments: toolArgs,
        });

        finalText.push(
          `${GREEN}[Tool Call] ${toolName}${RESET}\n${GREEN}Arguments: ${JSON.stringify(
            toolArgs,
            null,
            2
          )}${RESET}\n${BLUE}Result: ${this.formatToolResult(result)}${RESET}`
        );

        this.messageHistory.push({
          role: "assistant",
          content: [content as ToolUseBlockParam],
        });

        const toolResult: ToolResultBlockParam = {
          tool_use_id: content.id,
          type: "tool_result",
          content: result.content as string,
        };
        this.messageHistory.push({
          role: "user",
          content: [toolResult],
        });

        // Recursively handle any additional tool calls
        // const additionalResponse = await this.handleToolCallResponseNonStream();
        const additionalResponse = await this.createRequest(false);
        const additionalText = await this.handleNonStreamResponse(
          additionalResponse
        );
        finalText.push(additionalText);
      }
    }

    return finalText.join("\n");
  }

  async processQuery(query: string) {
    // Add user query to message history
    this.messageHistory.push({
      role: "user",
      content: query,
    });

    const response = await this.createRequest(false);
    return this.handleNonStreamResponse(response);
  }

  private async handleStreamResponse(
    response: AsyncIterable<MessageStreamEvent>,
    onToken: (token: string) => void
  ): Promise<void> {
    let currentText = "";
    let currentToolUse: ToolUseBlockParam | null = null;
    let currentToolInput = "";

    for await (const chunk of response) {
      const event = chunk as MessageStreamEvent;

      if (event.type === "content_block_start") {
        const start = event as ContentBlockStartEvent;
        // If we have accumulated text, add it to message history before starting new block
        if (currentText) {
          this.messageHistory.push({
            role: "assistant",
            content: currentText,
          });
          currentText = "";
        }

        if (start.content_block.type === "tool_use") {
          currentToolUse = {
            id: start.content_block.id,
            type: "tool_use",
            name: start.content_block.name,
            input: {},
          };
          onToken(
            `\n${GREEN}[Tool Call] ${start.content_block.name}${RESET}\n`
          );
        }
      } else if (event.type === "content_block_delta") {
        const delta = event as ContentBlockDeltaEvent;
        if (delta.delta.type === "text_delta") {
          currentText += delta.delta.text;
          onToken(delta.delta.text);
        } else if (delta.delta.type === "input_json_delta" && currentToolUse) {
          currentToolInput += delta.delta.partial_json;
          onToken(`${GREEN}${delta.delta.partial_json}${RESET}`);
        }
      } else if (event.type === "content_block_stop" && currentToolUse) {
        try {
          const input = JSON.parse(currentToolInput);
          currentToolUse.input = input;

          const result = await this.mcp.callTool({
            name: currentToolUse.name,
            arguments: input,
          });

          this.messageHistory.push({
            role: "assistant",
            content: [currentToolUse],
          });

          const toolResult: ToolResultBlockParam = {
            tool_use_id: currentToolUse.id,
            type: "tool_result",
            content: result.content as string,
          };
          this.messageHistory.push({
            role: "user",
            content: [toolResult],
          });

          onToken(
            `\n${BLUE}Result: ${this.formatToolResult(result)}${RESET}\n`
          );

          // Handle any additional tool calls by creating a new message and streaming it
          await this.createAndRunRequest(onToken);
        } catch (error) {
          console.error("Error handling tool call response:", error);
        }

        currentToolUse = null;
        currentToolInput = "";
      }
    }

    // Add any remaining text to message history
    if (currentText) {
      this.messageHistory.push({
        role: "assistant",
        content: currentText,
      });
    }
  }

  async processQueryStream(query: string, onToken: (token: string) => void) {
    /**
     * Process a query using Claude and available tools with streaming response
     *
     * @param query - The user's input query
     * @param onToken - Callback function to handle each token of the response
     */
    // Add user query to message history
    this.messageHistory.push({
      role: "user",
      content: query,
    });

    await this.createAndRunRequest(onToken);
  }

  private async createAndRunRequest(onToken: (token: string) => void) {
    const stream = await this.createRequest(true);
    await this.handleStreamResponse(stream, onToken);
  }

  private async handleSpecialCommand(message: string): Promise<boolean> {
    /**
     * Handle special commands like quit, exit, history
     * @param message - The user's input message
     * @returns true if the message was handled as a special command
     */
    const trimmed = message.trim().toLowerCase();

    switch (trimmed) {
      case "quit":
      case "exit":
        return true;

      default:
        if (trimmed.startsWith("history")) {
          const args = trimmed.slice("history".length).trim();
          let count = 20; // Default to last 20 commands

          if (args) {
            // Handle both "history N" and "history -n N" formats
            const match = args.match(/^(-n\s+)?(\d+)$/);
            if (match) {
              count = parseInt(match[2], 10);
            } else {
              console.log("Usage: history [N] or history -n N");
              return true;
            }
          }

          // Get the last N commands
          const start = Math.max(0, this.commandHistory.length - count);
          const history = this.commandHistory.slice(start);

          // Print with line numbers
          history.forEach((cmd: string, index: number) => {
            console.log(`${start + index + 1}  ${cmd}`);
          });
          return true;
        }
        return false;
    }
  }

  async chatLoop() {
    /**
     * Run an interactive chat loop with streaming responses
     */
    // Load command history
    await this.loadHistory();

    // Load chat file if specified
    if (this.options.chatFile) {
      await this.loadChatFile(this.options.chatFile);
    }

    // Create readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      history: this.commandHistory,
      historySize: 1000, // Keep last 1000 commands
    });

    try {
      console.log("\nWelcome to MCP Chat Interactive!");
      console.log("See connected server(s) with tools above.");
      console.log("Commands:");
      console.log("  exit, quit - Close the chat");
      console.log("  history [N] - View last N commands (default 20)");
      console.log("\nPress up/down arrow keys to navigate command history.");
      console.log(
        "Chat history will be saved to a file in ~/.mcpchat/chats after each response."
      );
      console.log("Use 'Ctrl+C' to exit at any time.");

      while (true) {
        const message = await this.rl.question("\n> ");

        // Handle special commands first
        if (await this.handleSpecialCommand(message)) {
          const trimmed = message.trim().toLowerCase();
          if (trimmed === "quit" || trimmed === "exit") {
            break;
          }
          continue;
        }

        // Add message to history
        if (message.trim()) {
          // Save history before running each command
          await this.saveHistory();
        }

        // Process the query with streaming response
        await this.processQueryStream(message, (token) => {
          process.stdout.write(token);
        });
        console.log("\n"); // Add a newline after the response

        // Save chat after each response
        await this.saveChatFile();
      }
    } finally {
      this.rl.close();
      this.rl = null;
    }
  }

  async cleanup() {
    /**
     * Clean up resources
     */
    await this.mcp.close();
  }
}

async function setupChat(options: ChatOptions): Promise<MCPClient> {
  const mcpClient = new MCPClient(options);

  if (options.servers) {
    for (const server of options.servers) {
      try {
        await mcpClient.connectToServer(server);
      } catch (err) {
        console.warn(`Failed to connect to server ${server}`);
        console.warn(err);
      }
    }
  } else {
    console.warn("No mcp server specified. Starting chat loop without server.");
  }

  return mcpClient;
}

export async function startInteractiveChat(options: ChatOptions) {
  const mcpClient = await setupChat(options);
  try {
    await mcpClient.chatLoop();
  } finally {
    await mcpClient.cleanup();
    process.exit(0);
  }
}

export async function runPrompt(options: ChatOptions & { prompt: string }) {
  const mcpClient = await setupChat(options);
  try {
    // If a chat file is specified, load it first without printing history
    if (options.chatFile) {
      await mcpClient.loadChatFile(options.chatFile, false);
    }

    const response = await mcpClient.processQuery(options.prompt);
    console.log(response);

    // Save the chat file if we loaded one or created a new one
    await mcpClient.saveChatFile();
  } finally {
    await mcpClient.cleanup();
    process.exit(0);
  }
}
