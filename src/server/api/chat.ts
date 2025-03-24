import { Request, Response } from "express";
import path from "path";
import os from "os";
import fs from "fs/promises";
import { ChatFileFormat } from "./chats.js";
import { DEFAULT_MODEL } from "../../constants.js";

// Get a single chat by ID
export async function getChatHandler(req: Request, res: Response) {
  try {
    const { chatId } = req.query;
    if (!chatId || typeof chatId !== "string") {
      return res
        .status(400)
        .json({ error: "chatId query parameter is required" });
    }

    const chatsDir = path.join(os.homedir(), ".mcpchat", "chats");
    const chatPath = path.join(chatsDir, chatId);

    // Read the chat file
    const fileContent = await fs.readFile(chatPath, "utf-8");
    const chatData = JSON.parse(fileContent) as ChatFileFormat;

    res.json({
      id: chatId,
      title: chatData.title,
      messages: chatData.messages,
      settings: {
        title: chatData.title,
        ...(chatData.settings || {
          model: DEFAULT_MODEL,
          servers: [],
        }),
      },
    });
  } catch (error) {
    console.error("Error loading chat:", error);
    res.status(500).json({ error: "Failed to load chat" });
  }
}

export default {
  get: getChatHandler,
};
