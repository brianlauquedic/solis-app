const KEY_PREFIX = "solis_chat_";
const MAX_MESSAGES = 20;

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

export interface ChatMemory {
  walletAddress: string;
  messages: ChatMessage[];
  sessionSummary?: string;
  savedAt: number;
}

export function loadChatMemory(walletAddress: string): ChatMemory | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY_PREFIX + walletAddress);
    if (!raw) return null;
    return JSON.parse(raw) as ChatMemory;
  } catch {
    return null;
  }
}

export function saveChatMemory(walletAddress: string, memory: Omit<ChatMemory, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const toSave: ChatMemory = {
      ...memory,
      messages: memory.messages.slice(-MAX_MESSAGES),
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY_PREFIX + walletAddress, JSON.stringify(toSave));
  } catch { /* ignore */ }
}

export function clearChatMemory(walletAddress: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY_PREFIX + walletAddress);
  } catch { /* ignore */ }
}
