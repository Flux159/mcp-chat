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

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY is not set");
}

const MAX_TOKENS = 4096;
const GREEN = "\x1b[32m";
const BLUE = "\x1b[34m";
const RESET = "\x1b[0m";

class MCPClient {
  private mcp: Client;
  private anthropic: Anthropic;
  private transport: StdioClientTransport | null = null;
  private tools: Tool[] = [];
  private messageHistory: MessageParam[] = [];

  constructor(public model: string = "claude-3-5-sonnet-20241022") {
    // Initialize Anthropic client and MCP client
    this.anthropic = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
    });
    this.mcp = new Client({ name: "mcp-client-cli", version: "1.0.0" });
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
        "Connected to server with tools:",
        this.tools.map(({ name }) => name)
      );
    } catch (e) {
      console.log("Failed to connect to MCP server: ", e);
      throw e;
    }
  }

  async processQuery(query: string) {
    /**
     * Process a query using Claude and available tools
     *
     * @param query - The user's input query
     * @returns Processed response as a string
     */
    // Add user query to message history
    this.messageHistory.push({
      role: "user",
      content: query,
    });

    // Initial Claude API call with full message history
    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: MAX_TOKENS,
      messages: this.messageHistory,
      tools: this.tools,
    });

    // Process response and handle tool calls
    const finalText = [];
    const toolResults = [];

    for (const content of response.content) {
      if (content.type === "text") {
        finalText.push(content.text);
        // Add assistant's text response to message history
        this.messageHistory.push({
          role: "assistant",
          content: content.text,
        });
      } else if (content.type === "tool_use") {
        // Execute tool call
        const toolName = content.name;
        const toolArgs = content.input as { [x: string]: unknown } | undefined;

        const result = await this.mcp.callTool({
          name: toolName,
          arguments: toolArgs,
        });
        toolResults.push(result);
        finalText.push(
          `${GREEN}[Tool Call] ${toolName}${RESET}\n${GREEN}Arguments: ${JSON.stringify(
            toolArgs,
            null,
            2
          )}${RESET}`
        );

        // Add tool use to message history
        this.messageHistory.push({
          role: "assistant",
          content: [content as ToolUseBlockParam],
        });

        // Add tool result to message history
        const toolResult: ToolResultBlockParam = {
          tool_use_id: content.id,
          type: "tool_result",
          content: result.content as string,
        };
        this.messageHistory.push({
          role: "user",
          content: [toolResult],
        });

        // Get next response from Claude with full message history
        const response = await this.anthropic.messages.create({
          model: this.model,
          max_tokens: 1000,
          messages: this.messageHistory,
        });

        const responseText =
          response.content[0].type === "text" ? response.content[0].text : "";
        finalText.push(responseText);
        // Add assistant's final response to message history
        this.messageHistory.push({
          role: "assistant",
          content: responseText,
        });
      }
    }

    return finalText.join("\n");
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

    let currentText = "";
    let currentToolUse: ToolUseBlockParam | null = null;
    let currentToolInput = "";

    // Stream the response
    const stream = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: MAX_TOKENS,
      messages: this.messageHistory,
      tools: this.tools,
      stream: true,
    });

    for await (const chunk of stream) {
      const event = chunk as MessageStreamEvent;

      if (event.type === "content_block_start") {
        const start = event as ContentBlockStartEvent;
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
        // Parse the complete JSON input
        try {
          const input = JSON.parse(currentToolInput);
          currentToolUse.input = input;

          // Execute tool call
          const result = await this.mcp.callTool({
            name: currentToolUse.name,
            arguments: input,
          });

          // Add tool use and result to message history
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
            `\n${BLUE}Result: ${JSON.stringify(
              result.content,
              null,
              2
            )}${RESET}\n`
          );

          // Get next response from Claude with full message history
          const response = await this.anthropic.messages.create({
            model: this.model,
            max_tokens: 1000,
            messages: this.messageHistory,
            stream: true,
          });

          for await (const responseChunk of response) {
            const responseEvent = responseChunk as MessageStreamEvent;
            if (responseEvent.type === "content_block_delta") {
              const delta = responseEvent as ContentBlockDeltaEvent;
              if (delta.delta.type === "text_delta") {
                onToken(delta.delta.text);
              }
            }
          }
        } catch (error) {
          console.error("Error parsing tool input JSON:", error);
        }

        currentToolUse = null;
        currentToolInput = "";
      }
    }

    // Add the complete response to message history
    if (currentText) {
      this.messageHistory.push({
        role: "assistant",
        content: currentText,
      });
    }
  }

  async chatLoop() {
    /**
     * Run an interactive chat loop with streaming responses
     */
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      console.log("\nMCP Client Started!");
      console.log("Type your queries or 'exit' or 'quit' to close.");

      while (true) {
        const message = await rl.question("\nQuery: ");
        if (
          message.toLowerCase() === "quit" ||
          message.toLowerCase() === "exit"
        ) {
          break;
        }

        // Process the query with streaming response
        await this.processQueryStream(message, (token) => {
          process.stdout.write(token);
        });
        console.log("\n"); // Add a newline after the response
      }
    } finally {
      rl.close();
    }
  }

  async cleanup() {
    /**
     * Clean up resources
     */
    await this.mcp.close();
  }
}

type ChatOptions = {
  servers?: string[];
  configPath?: string;
  model?: string;
};

async function setupChat(options: ChatOptions): Promise<MCPClient> {
  const mcpClient = new MCPClient(options.model);

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
    const response = await mcpClient.processQuery(options.prompt);
    console.log(response);
  } finally {
    await mcpClient.cleanup();
    process.exit(0);
  }
}
