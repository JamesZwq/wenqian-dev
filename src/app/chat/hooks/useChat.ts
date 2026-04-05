"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePeerConnection } from "../../../features/p2p/hooks/usePeerConnection";
import { useJoinParam } from "../../../features/p2p/hooks/useJoinParam";
import { P2P_CONNECT_TIMEOUT_MS } from "../../../features/p2p/config";
import {
  decryptWithPrivateKey,
  encryptWithPublicKey,
  generateRsaKeyPair,
  importRsaPublicKey,
} from "../../../features/p2p/lib/p2pCrypto";
import type { ChatMessage, ChatPacket } from "../types";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [localKeyPair, setLocalKeyPair] = useState<CryptoKeyPair | null>(null);
  const [localPublicKey, setLocalPublicKey] = useState<string | null>(null);
  const [remotePublicKey, setRemotePublicKey] = useState<CryptoKey | null>(null);
  const joinPeerId = useJoinParam();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageIdRef = useRef(0);
  const handshakeSentRef = useRef(false);

  // Generate local RSA key pair on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { keyPair, publicKeyBase64 } = await generateRsaKeyPair();
        if (cancelled) return;
        setLocalKeyPair(keyPair);
        setLocalPublicKey(publicKeyBase64);
      } catch {
        // keep UI usable even if keygen fails
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const appendMessage = useCallback((message: Omit<ChatMessage, "id">) => {
    messageIdRef.current += 1;
    setMessages(prev => [...prev, { id: `msg-${message.timestamp}-${messageIdRef.current}`, ...message }]);
  }, []);

  const handleIncomingData = useCallback((payload: ChatPacket) => {
    if (!payload?.type) return;

    if (payload.type === "handshake" && payload.publicKey) {
      (async () => {
        try {
          const imported = await importRsaPublicKey(payload.publicKey);
          setRemotePublicKey(imported);
        } catch {
          // ignore bad public key
        }
      })();
      return;
    }

    if (payload.type === "chat-message" && payload.ciphertext) {
      if (!localKeyPair?.privateKey) return;
      (async () => {
        try {
          const decrypted = await decryptWithPrivateKey(localKeyPair.privateKey, payload.ciphertext);
          appendMessage({ text: decrypted, sender: "peer", timestamp: payload.timestamp });
        } catch {
          appendMessage({ text: "[Decryption failed]", sender: "peer", timestamp: payload.timestamp });
        }
      })();
    }
  }, [appendMessage, localKeyPair?.privateKey]);

  const { phase, localPeerId, remotePeerId, error, isConnected, connect, disconnect, send, clearError, retryLastConnection, reinitialize, roomCode } =
    usePeerConnection<ChatPacket>({
      connectTimeoutMs: P2P_CONNECT_TIMEOUT_MS,
      handshake: { site: "wenqian.me", game: "chat" },
      onData: handleIncomingData,
      acceptIncomingConnections: true,
    });

  // Reset handshake + remote key on disconnect
  useEffect(() => {
    if (!isConnected) {
      handshakeSentRef.current = false;
      setRemotePublicKey(null);
    }
  }, [isConnected]);

  // Send public key as soon as connected
  useEffect(() => {
    if (!isConnected || !localPublicKey || handshakeSentRef.current) return;
    send({ type: "handshake", publicKey: localPublicKey, timestamp: Date.now() });
    handshakeSentRef.current = true;
  }, [isConnected, localPublicKey, send]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    if (!remotePublicKey) {
      appendMessage({ text: "Waiting for peer key handshake...", sender: "me", timestamp: Date.now() });
      return;
    }

    const timestamp = Date.now();
    try {
      const ciphertext = await encryptWithPublicKey(remotePublicKey, trimmed);
      const success = send({ type: "chat-message", ciphertext, timestamp });
      if (!success) return;
      appendMessage({ text: trimmed, sender: "me", timestamp });
      setInputText("");
    } catch {
      appendMessage({ text: "[Encryption failed]", sender: "me", timestamp });
    }
  }, [appendMessage, inputText, remotePublicKey, send]);

  const encryptionReady = isConnected && Boolean(remotePublicKey && localKeyPair?.privateKey);

  return {
    messages, inputText, setInputText,
    encryptionReady,
    messagesEndRef,
    handleSendMessage,
    // Connection
    phase, localPeerId, remotePeerId, error, isConnected, roomCode,
    connect, disconnect, clearError, retryLastConnection, reinitialize,
    joinPeerId,
  };
}
