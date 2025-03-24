import { Request, Response } from "express";
import path from "path";
import os from "os";
import fs from "fs/promises";
import { ChatFileFormat } from "../chats.js";

export async function putSettingsHandler(req: Request, res: Response) {
  try {
    const { chatId } = req.query;
    const newSettings = req.body;

    if (!chatId || typeof chatId !== "string") {
      return res.status(400).json({ error: "chatId is required" });
    }

    const chatsDir = path.join(os.homedir(), ".mcpchat", "chats");
    const chatPath = path.join(chatsDir, chatId);

    // Read the existing chat file
    const fileContent = await fs.readFile(chatPath, "utf-8");
    const chatData = JSON.parse(fileContent) as ChatFileFormat;

    // Update title if it's in the settings
    if ("title" in newSettings) {
      chatData.title = newSettings.title;
      delete newSettings.title; // Remove title from settings object
    }

    // Update settings
    chatData.settings = {
      ...chatData.settings,
      ...newSettings,
    };

    // Write the updated chat file
    await fs.writeFile(chatPath, JSON.stringify(chatData, null, 2));

    res.json({
      title: chatData.title,
      ...chatData.settings,
    });
  } catch (error) {
    console.error("Error updating chat settings:", error);
    res.status(500).json({ error: "Failed to update chat settings" });
  }
}

export default {
  put: putSettingsHandler,
};
