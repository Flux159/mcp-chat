import { Request, Response } from "express";
import path from "path";
import os from "os";
import fs from "fs/promises";
import { ChatFileFormat } from "../chats.js";
import { DEFAULT_MODEL } from "../../../constants.js";

export async function postCreateHandler(req: Request, res: Response) {
  try {
    const chatsDir = path.join(os.homedir(), ".mcpchat", "chats");

    // Ensure chats directory exists
    await fs.mkdir(chatsDir, { recursive: true });

    // Get list of existing chat files
    const files = await fs.readdir(chatsDir);
    const chatFiles = files.filter(
      (file) => file.startsWith("chat-") && file.endsWith(".json")
    );
    const index = chatFiles.length + 1;
    const timestamp = Date.now();

    // Create new chat file path
    const chatId = `chat-${index}-${timestamp}.json`;
    const chatPath = path.join(chatsDir, chatId);

    // Create initial chat data
    const chatData: ChatFileFormat = {
      title: `Chat ${index} - ${new Date(timestamp).toLocaleString()}`,
      settings: {
        model: DEFAULT_MODEL,
      },
      messages: [],
    };

    // Write the chat file
    await fs.writeFile(chatPath, JSON.stringify(chatData, null, 2));

    res.json({
      id: chatId,
      title: chatData.title,
      model: chatData.settings.model,
      lastModified: new Date(timestamp).toISOString(),
      messageCount: 0,
    });
  } catch (error) {
    console.error("Error creating chat:", error);
    res.status(500).json({ error: "Failed to create chat" });
  }
}

export default {
  post: postCreateHandler,
};
