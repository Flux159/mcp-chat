import { Router } from "express";
import path from "path";
import os from "os";
import fs from "fs/promises";
import { ChatFileFormat } from "./chats.js";

const router = Router();

// Get a single chat by ID
router.get("/:chatId", async (req, res) => {
  try {
    const { chatId } = req.params;
    const chatsDir = path.join(os.homedir(), ".mcpchat", "chats");
    const chatPath = path.join(chatsDir, chatId);

    // Read the chat file
    const fileContent = await fs.readFile(chatPath, "utf-8");
    const chatData = JSON.parse(fileContent) as ChatFileFormat;

    res.json({
      id: chatId,
      title: chatData.title,
      model: chatData.settings?.model,
      messages: chatData.messages,
    });
  } catch (error) {
    console.error("Error loading chat:", error);
    res.status(500).json({ error: "Failed to load chat" });
  }
});

// Send a message to a chat
router.post("/:chatId/message", async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;
    const chatsDir = path.join(os.homedir(), ".mcpchat", "chats");
    const chatPath = path.join(chatsDir, chatId);

    // Read the existing chat file
    const fileContent = await fs.readFile(chatPath, "utf-8");
    const chatData = JSON.parse(fileContent) as ChatFileFormat;

    // Create new message
    const newMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };

    // Add the new message to the chat
    chatData.messages.push(newMessage);

    // Create a stub response
    const responseMessage = {
      id: `msg-${Date.now() + 1}`,
      role: "assistant",
      content:
        "This is a stub response. The actual implementation would generate a real response.",
      timestamp: new Date().toISOString(),
    };

    // Add the response to the chat
    chatData.messages.push(responseMessage);

    // Save the updated chat file
    await fs.writeFile(chatPath, JSON.stringify(chatData, null, 2));

    res.json({
      message: newMessage,
      response: responseMessage,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
