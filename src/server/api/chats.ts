import { Request, Response } from "express";
import path from "path";
import os from "os";
import fs from "fs/promises";

export interface ChatSettings {
  model: string;
  systemPrompt?: string;
  servers?: string[];
}

export interface ChatFileFormat {
  title: string;
  settings: ChatSettings;
  messages: any[]; // Using any[] since the message format is complex and defined elsewhere
}

export interface ChatListItem {
  id: string;
  title: string;
  model: string | undefined;
  lastModified: string;
  messageCount: number;
}

export async function getChatsHandler(req: Request, res: Response) {
  try {
    const chatsDir = path.join(os.homedir(), ".mcpchat", "chats");
    const files = await fs.readdir(chatsDir);
    const chatFiles = files.filter(
      (file) => file.startsWith("chat-") && file.endsWith(".json")
    );

    const chats = await Promise.all(
      chatFiles.map(async (file) => {
        const content = await fs.readFile(path.join(chatsDir, file), "utf-8");
        const chatData = JSON.parse(content) as ChatFileFormat;
        return {
          id: file,
          title: chatData.title,
          model: chatData.settings?.model,
          lastModified: new Date(
            parseInt(file.split("-")[2].split(".")[0])
          ).toISOString(),
          messageCount: chatData.messages.length,
        } as ChatListItem;
      })
    );

    // Sort chats by last modified date, newest first
    chats.sort(
      (a, b) =>
        new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );

    res.json(chats);
  } catch (error) {
    console.error("Error fetching chats:", error);
    res.status(500).json({ error: "Failed to fetch chats" });
  }
}

export default {
  get: getChatsHandler,
};
