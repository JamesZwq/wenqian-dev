export type ChatPacket =
  | { type: "handshake"; publicKey: string; timestamp: number }
  | { type: "chat-message"; ciphertext: string; timestamp: number };

export type ChatMessage = {
  id: string;
  text: string;
  sender: "me" | "peer";
  timestamp: number;
};
