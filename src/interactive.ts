import { Anthropic } from "@anthropic-ai/sdk";
import {
  MessageParam,
  Tool,
} from "@anthropic-ai/sdk/resources/messages/messages.mjs";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import readline from "readline/promises";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY is not set");
}

const MAX_TOKENS = 4096;

class MCPClient {
  private mcp: Client;
  private anthropic: Anthropic;
  private transport: StdioClientTransport | null = null;
  private tools: Tool[] = [];

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
    const messages: MessageParam[] = [
      {
        role: "user",
        content: query,
      },
    ];

    // Initial Claude API call
    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: MAX_TOKENS,
      messages,
      tools: this.tools,
    });

    // Process response and handle tool calls
    const finalText = [];
    const toolResults = [];

    for (const content of response.content) {
      if (content.type === "text") {
        finalText.push(content.text);
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
          `[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]`
        );

        // Continue conversation with tool results
        messages.push({
          role: "user",
          content: result.content as string,
        });

        // Get next response from Claude
        const response = await this.anthropic.messages.create({
          model: this.model,
          max_tokens: 1000,
          messages,
        });

        finalText.push(
          response.content[0].type === "text" ? response.content[0].text : ""
        );
      }
    }

    return finalText.join("\n");
  }

  async chatLoop() {
    /**
     * Run an interactive chat loop
     */
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      console.log("\nMCP Client Started!");
      console.log("Type your queries or 'quit' to exit.");

      while (true) {
        const message = await rl.question("\nQuery: ");
        if (message.toLowerCase() === "quit") {
          break;
        }
        const response = await this.processQuery(message);
        console.log("\n" + response);
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
      console.log(server);
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
