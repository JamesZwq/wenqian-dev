"use client";

import { useCallback, useState } from "react";

export interface ChatMessage {
  id: string;
  text: string;
  from: "me" | "opponent" | "system";
  at: number;
}

let _counter = 0;
function uid(): string {
  return `${Date.now()}-${++_counter}`;
}

export function useP2PChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const onChat = useCallback((text: string) => {
    setMessages(prev => [...prev, { id: uid(), text, from: "opponent", at: Date.now() }]);
  }, []);

  const addMyMessage = useCallback((text: string) => {
    setMessages(prev => [...prev, { id: uid(), text, from: "me", at: Date.now() }]);
  }, []);

  return { messages, onChat, addMyMessage };
}
