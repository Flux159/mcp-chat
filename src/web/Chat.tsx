import React, { useEffect, useState } from "react";
import styles from "./Chat.module.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string | any[];
  timestamp: string;
}

interface ToolInteraction {
  type: "tool_use" | "tool_result";
  id: string;
  name?: string;
  input?: any;
  content?: any;
  tool_use_id?: string;
}

interface ChatProps {
  chatId: string;
}

export function Chat({ chatId }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const fetchChat = async () => {
      try {
        const response = await fetch(`/api/chat/${chatId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch chat");
        }
        const data = await response.json();
        setMessages(data.messages);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch chat");
      }
    };

    fetchChat();
  }, [chatId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const response = await fetch(`/api/chat/${chatId}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: newMessage }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json();
      setMessages((prev) => [...prev, data.message, data.response]);
      setNewMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
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
    <div className={styles.chatContainer}>
      {error && <div className={styles.error}>{error}</div>}
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
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className={styles.inputForm}>
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          className={styles.messageInput}
        />
        <button type="submit" className={styles.sendButton}>
          Send
        </button>
      </form>
    </div>
  );
}
