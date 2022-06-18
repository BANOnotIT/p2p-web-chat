import { ChatStore } from "../services/ChatStore";
import { HyperCoreSyncStatus } from "../services/HypercoreSynchronize";
import { useCallback, useEffect, useState } from "react";
import { ViewMessage } from "../services/MessageViewer";
import { UserMessageBuf } from "../protobuf/UserMessage.buf";
import { genId } from "../utils/torrent";

const MESSAGES_HUNK = 10;

export function useChat(chat: ChatStore) {
  const [onlineStatus, setOnlineStatus] = useState(
    HyperCoreSyncStatus.notInitialized,
  );
  const [messages, setMessages] = useState<Array<ViewMessage>>([]);

  useEffect(() => {
    const onlineListener = () => {
      setOnlineStatus(chat.onlineStatus);
    };

    chat.on("online-change", onlineListener);

    return () => {
      chat.off("online-change", onlineListener);
    };
  }, [chat]);

  useEffect(() => {
    const refreshMessages = () => {
      setMessages(chat.messages.slice());
    };

    chat.on("messages-updated", refreshMessages);

    return () => {
      chat.off("messages-updated", refreshMessages);
    };
  }, [chat]);

  const sendMessage = useCallback(
    (text: string) => {
      const msg = new UserMessageBuf();
      msg.text = text;
      msg.sender = "me";
      msg.nonce = genId(20);
      msg.padding = genId(Math.max(0, 100 - text.length));
      msg.senderTimestamp = Date.now();

      void chat.sendMessage(msg);
    },
    [chat],
  );

  const init = useCallback(() => {
    chat.requestInitialMessages(MESSAGES_HUNK);
    chat.connectToPeers();
  }, [chat]);
  const requestMoreMessages = useCallback(
    () => chat.requestInitialMessages(MESSAGES_HUNK),
    [chat],
  );

  return {
    sendMessage,
    onlineStatus,
    messages,
    init,
    requestMoreMessages,
  };
}
