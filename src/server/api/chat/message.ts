import { Request, Response } from "express";
import path from "path";
import os from "os";
import fs from "fs/promises";
import { ChatFileFormat } from "../chats.js";
import { MCPClient } from "../../../interactive.js";
import { MessageParam } from "@anthropic-ai/sdk/resources/messages/messages.mjs";

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

    // Process the message and get response
    await mcpClient.processQueryStream(content, async (token) => {
      // The MCPClient will handle tool calls and message history internally
    });

    // Save the updated chat file with all messages
    await mcpClient.saveChatFile();

    // Read the updated chat file to get the latest messages
    const updatedContent = await fs.readFile(chatPath, "utf-8");
    const updatedChatData = JSON.parse(updatedContent) as ChatFileFormat;
    const messages = updatedChatData.messages.slice(-2);
    const [userMessage, assistantMessage] = messages;

    res.json({
      message: userMessage,
      response: assistantMessage,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
}

export default {
  post: postMessageHandler,
};
