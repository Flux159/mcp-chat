import React, { useState, useEffect } from "react";
import styles from "./ChatSettings.module.css";

interface ChatSettings {
  model: string;
  systemPrompt?: string;
  servers?: string[];
}

interface ChatSettingsProps {
  chatId: string;
  settings: ChatSettings;
  onSave: (settings: ChatSettings) => void;
  onClose: () => void;
}

export function ChatSettings({
  chatId,
  settings: initialSettings,
  onSave,
  onClose,
}: ChatSettingsProps) {
  const [settings, setSettings] = useState<ChatSettings>(initialSettings);
  const [newServer, setNewServer] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(settings);
  };

  const addServer = () => {
    if (newServer.trim()) {
      setSettings((prev) => ({
        ...prev,
        servers: [...(prev.servers || []), newServer.trim()],
      }));
      setNewServer("");
    }
  };

  const removeServer = (index: number) => {
    setSettings((prev) => ({
      ...prev,
      servers: prev.servers?.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className={styles.settingsOverlay}>
      <div className={styles.settingsModal}>
        <h2>Chat Settings</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="model">Model:</label>
            <input
              type="text"
              id="model"
              value={settings.model}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, model: e.target.value }))
              }
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="systemPrompt">System Prompt:</label>
            <textarea
              id="systemPrompt"
              value={settings.systemPrompt || ""}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  systemPrompt: e.target.value,
                }))
              }
              rows={4}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Servers:</label>
            <div className={styles.serversList}>
              {settings.servers?.map((server, index) => (
                <div key={index} className={styles.serverItem}>
                  <span>{server}</span>
                  <button
                    type="button"
                    onClick={() => removeServer(index)}
                    className={styles.removeButton}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className={styles.addServer}>
              <input
                type="text"
                value={newServer}
                onChange={(e) => setNewServer(e.target.value)}
                placeholder="Enter server path"
              />
              <button type="button" onClick={addServer}>
                Add Server
              </button>
            </div>
          </div>

          <div className={styles.actions}>
            <button type="submit" className={styles.saveButton}>
              Save Settings
            </button>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
