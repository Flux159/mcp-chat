import { Request, Response } from "express";
import path from "path";
import os from "os";
import fs from "fs/promises";
import { ChatFileFormat } from "../chats.js";
import { MCPClient } from "../../../interactive.js";
import { DEFAULT_MODEL } from "../../../constants.js";

// Add process-level error handlers for uncaught exceptions in MCPClient when servers are invalid
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // Don't exit the process, just log the error
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Don't exit the process, just log the error
});

export async function postMessageHandler(req: Request, res: Response) {
  try {
    const { chatId } = req.query;
    const { content } = req.body;

    if (!chatId || typeof chatId !== "string") {
      return res
        .status(400)
        .json({ error: "chatId query parameter is required" });
    }

    if (!content || typeof content !== "string") {
      return res
        .status(400)
        .json({ error: "content is required in request body" });
    }

    const chatsDir = path.join(os.homedir(), ".mcpchat", "chats");
    const chatPath = path.join(chatsDir, chatId);

    // Read the existing chat file
    const fileContent = await fs.readFile(chatPath, "utf-8");
    const chatData = JSON.parse(fileContent) as ChatFileFormat;

    // Set up SSE headers early
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Initialize MCP client with chat settings
    let mcpClient: MCPClient | null = null;
    let disableServers = false;

    try {
      mcpClient = new MCPClient({
        model: chatData.settings?.model,
        systemPrompt: chatData.settings?.systemPrompt,
        servers: chatData.settings?.servers || [],
      });

      // Connect to servers if specified
      if (chatData.settings?.servers?.length) {
        for (const server of chatData.settings.servers) {
          try {
            await mcpClient.connectToServer(server);
          } catch (err) {
            console.warn(`Failed to connect to server ${server}:`, err);
            console.warn(
              "Resetting MCP client without servers. Please fix the server string in chat settings."
            );

            // If there's an error, then reset the client without any servers
            mcpClient = new MCPClient({
              model: chatData.settings?.model,
              systemPrompt: chatData.settings?.systemPrompt,
              servers: [],
            });
            disableServers = true;
            break;
          }
        }
      }

      // Load the chat history into the MCP client
      await mcpClient.loadChatFile(chatPath, false, disableServers);

      // Process the message and get response with streaming
      await mcpClient.processQueryStream(content, async (token) => {
        // Send each token as an SSE event
        res.write(
          `data: ${JSON.stringify({ type: "token", content: token })}\n\n`
        );
      });

      // Save the updated chat file with all messages
      await mcpClient.saveChatFile();

      // Read the updated chat file to get all messages
      const updatedContent = await fs.readFile(chatPath, "utf-8");
      const updatedChatData = JSON.parse(updatedContent) as ChatFileFormat;

      // Send final message with complete chat state
      res.write(
        `data: ${JSON.stringify({
          type: "complete",
          data: {
            id: chatId,
            title: updatedChatData.title,
            messages: updatedChatData.messages,
            settings: updatedChatData.settings || {
              model: DEFAULT_MODEL,
              servers: [],
            },
          },
        })}\n\n`
      );
    } catch (error) {
      console.error("Error in MCP client operations:", error);
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error:
            "Failed to process message. Please check your server settings.",
        })}\n\n`
      );
    } finally {
      // Ensure we clean up the MCP client
      if (mcpClient) {
        try {
          await mcpClient.cleanup();
        } catch (err) {
          console.warn("Error cleaning up MCP client:", err);
        }
      }
      res.end();
    }
  } catch (error) {
    console.error("Error in message handler:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
}

export default {
  post: postMessageHandler,
};
