export interface ChatSettings {
  title: string;
  model: string;
  systemPrompt?: string;
  servers?: string[];
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string | any[];
  timestamp: string;
}

export interface ToolInteraction {
  type: "tool_use" | "tool_result";
  id: string;
  name?: string;
  input?: any;
  content?: any;
  tool_use_id?: string;
}
