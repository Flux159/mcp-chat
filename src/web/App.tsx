import React, { useEffect, useState } from "react";
import styles from "./App.module.css";

interface ChatListItem {
  id: string;
  title: string;
  model: string | undefined;
  lastModified: string;
  messageCount: number;
}

function App() {
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const response = await fetch("/api/chats");
        if (!response.ok) {
          throw new Error("Failed to fetch chats");
        }
        const data = await response.json();
        setChats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch chats");
      }
    };

    fetchChats();
  }, []);

  return (
    <div className={styles.app}>
      <h1>MCP Chat</h1>
      {error ? (
        <div className={styles.error}>Error: {error}</div>
      ) : (
        <div className={styles.chatsList}>
          {chats.length === 0 ? (
            <p>No chats found. Start a new chat to begin!</p>
          ) : (
            chats.map((chat) => (
              <div key={chat.id} className={styles.chatItem}>
                <h3>{chat.title}</h3>
                <div className={styles.chatMeta}>
                  <span>Model: {chat.model || "Default"}</span>
                  <span>Messages: {chat.messageCount}</span>
                  <span>
                    Last modified:{" "}
                    {new Date(chat.lastModified).toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default App;
