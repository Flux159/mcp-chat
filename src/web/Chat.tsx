import React, { useEffect, useState, useRef } from "react";
import styles from "./Chat.module.css";
import { ChatSettings } from "./ChatSettings";
import {
  ChatSettings as ChatSettingsType,
  Message,
  ToolInteraction,
} from "./types";

interface ChatProps {
  chatId: string;
  onTitleChange?: (chatId: string, newTitle: string) => void;
}

export function Chat({ chatId, onTitleChange }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<ChatSettingsType | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const fetchChat = async () => {
      try {
        const response = await fetch(
          `/api/chat?chatId=${encodeURIComponent(chatId)}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch chat");
        }
        const data = await response.json();
        setMessages(data.messages);
        setSettings(data.settings);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch chat");
      }
    };

    fetchChat();
  }, [chatId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isLoading) return;

    try {
      setIsLoading(true);
      setError(null);

      // Create and show user message immediately
      const userMessage: Message = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: newMessage,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setNewMessage("");

      const response = await fetch(
        `/api/chat/message?chatId=${encodeURIComponent(chatId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: newMessage }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to get response reader");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          switch (data.type) {
            case "token":
              // Update the last assistant message with the new token
              setMessages((prev) => {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage?.role === "assistant") {
                  return [
                    ...prev.slice(0, -1),
                    {
                      ...lastMessage,
                      content: (lastMessage.content as string) + data.content,
                    },
                  ];
                } else {
                  return [
                    ...prev,
                    {
                      id: `msg-${Date.now()}`,
                      role: "assistant",
                      content: data.content,
                      timestamp: new Date().toISOString(),
                    },
                  ];
                }
              });
              break;

            case "complete":
              // Update with final state
              setMessages(data.data.messages);
              setSettings(data.data.settings);
              break;

            case "error":
              setError(data.error);
              break;
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSaveSettings = async (
    newSettings: ChatSettingsType,
    doNotClose?: boolean
  ) => {
    try {
      const response = await fetch(
        `/api/chat/settings?chatId=${encodeURIComponent(chatId)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newSettings),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      setSettings(newSettings);
      if (newSettings.title && onTitleChange) {
        onTitleChange(chatId, newSettings.title);
      }
      if (!doNotClose) {
        setShowSettings(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    }
  };

  const renderToolInteraction = (interaction: ToolInteraction) => {
    if (interaction.type === "tool_use") {
      return (
        <div className={styles.toolCall}>
          <div className={styles.toolName}>Tool: {interaction.name}</div>
          <div className={styles.toolInput}>
            <pre>{JSON.stringify(interaction.input, null, 2)}</pre>
          </div>
        </div>
      );
    } else if (interaction.type === "tool_result") {
      return (
        <div className={styles.toolResult}>
          <div className={styles.toolResultLabel}>Result:</div>
          <pre>{JSON.stringify(interaction.content, null, 2)}</pre>
        </div>
      );
    }
    return null;
  };

  const renderMessageContent = (content: string | any[]) => {
    if (typeof content === "string") {
      return content;
    }
    if (Array.isArray(content)) {
      return content.map((item: ToolInteraction, index: number) => (
        <div key={index} className={styles.toolInteraction}>
          {renderToolInteraction(item)}
        </div>
      ));
    }
    return null;
  };

  return (
    <div className={styles.chat}>
      <div className={styles.settingsBar}>
        <div className={styles.settingsInfo}>
          <div className={styles.settingsRow}>
            <span>Model: {settings?.model || "Default"}</span>
            {settings?.servers && settings.servers.length > 0 && (
              <span style={{ marginLeft: 8, fontWeight: "bold" }}>
                MCP Servers: {settings.servers.length}
              </span>
            )}
          </div>
          {settings?.systemPrompt && (
            <span
              style={{ maxHeight: 22, overflow: "auto", alignItems: "normal" }}
            >
              System: {settings.systemPrompt}
            </span>
          )}
        </div>
        <button
          className={styles.settingsButton}
          onClick={() => setShowSettings(true)}
        >
          Settings
        </button>
      </div>

      <div className={styles.messages}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`${styles.message} ${
              message.role === "user" && !Array.isArray(message.content)
                ? styles.userMessage
                : styles.assistantMessage
            }`}
          >
            <div className={styles.messageContent}>
              {renderMessageContent(message.content)}
            </div>
            {message.timestamp && !isNaN(Date.parse(message.timestamp)) && (
              <div className={styles.timestamp}>
                {new Date(message.timestamp).toLocaleString()}
              </div>
            )}
          </div>
        ))}
        {isLoading && <div className={styles.loading}>Thinking...</div>}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className={styles.inputForm}>
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
          className={styles.messageInput}
          disabled={isLoading}
        />
        <button
          type="submit"
          className={styles.sendButton}
          disabled={isLoading}
        >
          {isLoading ? (
            <svg
              className={styles.spinner}
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                className={styles.spinnerCircle}
                cx="12"
                cy="12"
                r="10"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
              />
            </svg>
          ) : (
            "Send"
          )}
        </button>
      </form>

      {error && <div className={styles.error}>{error}</div>}

      {showSettings && settings && (
        <ChatSettings
          chatId={chatId}
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
