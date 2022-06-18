import { ChatStore } from "../services/ChatStore";
import { SyntheticEvent, useCallback, useEffect, useState } from "react";
import { Box, Button, Input } from "@chakra-ui/react";
import { useChat } from "../hooks/useChat";
import { HyperCoreSyncStatus } from "../services/HypercoreSynchronize";

type Props = {
  chat: ChatStore;
};
export const MessagesList = (props: Props) => {
  const [messageText, setMessageText] = useState("");

  const { onlineStatus, messages, sendMessage, init } = useChat(props.chat);

  const handleSending = useCallback(
    (event?: SyntheticEvent) => {
      event?.preventDefault();

      if (!messageText) return;

      sendMessage(messageText);
      setMessageText("");
    },
    [messageText, sendMessage],
  );

  useEffect(() => {
    void props.chat.connectToPeers();

    return () => {
      props.chat.destroy();
    };
  }, [props.chat]);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <Box maxHeight={"100vh"} display={"flex"} flexDir={"column"}>
      <Box>{HyperCoreSyncStatus[onlineStatus]}</Box>
      <Box flexGrow={1} overflowY={"scroll"}>
        {messages.map((message) => (
          <div key={message.uuid}>
            {message.fromParticipant === 0 ? "me" : "them"}: {message.text}
          </div>
        ))}
      </Box>

      <form onSubmit={handleSending}>
        <Input
          value={messageText}
          onChange={(event) => setMessageText(event.currentTarget.value)}
        />
        <Button onClick={handleSending}>send</Button>
      </form>
    </Box>
  );
};
