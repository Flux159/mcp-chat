import { Request, Response } from "express";
import path from "path";
import os from "os";
import fs from "fs/promises";
import { ChatFileFormat } from "../chats.js";
import { MCPClient } from "../../../interactive.js";
import { DEFAULT_MODEL } from "../../../constants.js";

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

    // Initialize MCP client with chat settings
    const mcpClient = new MCPClient({
      model: chatData.settings?.model,
      systemPrompt: chatData.settings?.systemPrompt,
      servers: chatData.settings?.servers,
    });

    // Connect to servers if specified
    if (chatData.settings?.servers) {
      for (const server of chatData.settings.servers) {
        try {
          await mcpClient.connectToServer(server);
        } catch (err) {
          console.warn(`Failed to connect to server ${server}`);
          console.warn(err);
        }
      }
    }

    // Load the chat history into the MCP client
    await mcpClient.loadChatFile(chatPath, false);

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

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

    res.end();
  } catch (error) {
    console.error("Error sending message:", error);
    res.write(
      `data: ${JSON.stringify({
        type: "error",
        error: "Failed to send message",
      })}\n\n`
    );
    res.end();
  }
}

export default {
  post: postMessageHandler,
};
