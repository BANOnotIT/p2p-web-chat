import { ChatStore } from "../services/ChatStore";
import { UserMessageBuf } from "../protobuf/UserMessage.buf";
import { useCallback, useEffect, useState } from "react";
import { Button, Input } from "@chakra-ui/react";
import { genId } from "../utils/torrent";

type Props = {
  chat: ChatStore;
};
export const MessagesList = (props: Props) => {
  const [messages, setMessages] = useState<Array<UserMessageBuf>>([]);

  const [messageText, setMessageText] = useState("");

  useEffect(() => {
    props.chat.getMessages().then(setMessages);
  }, [props.chat]);

  const handleSending = useCallback(() => {
    const msg = new UserMessageBuf();
    msg.text = messageText;
    msg.sender = "me";
    msg.nonce = genId(20);
    msg.padding = genId(Math.max(0, 100 - messageText.length));
    msg.senderTimestamp = Date.now();

    void props.chat.sendMessage(msg);
    setMessageText("");
  }, [messageText, props.chat]);

  return (
    <div>
      {messages.map((message) => (
        <div key={message.nonce}>
          {message.sender}: {message.text}
        </div>
      ))}

      <form>
        <Input
          value={messageText}
          onChange={(event) => setMessageText(event.currentTarget.value)}
        />
        <Button onClick={handleSending}>send</Button>
      </form>
    </div>
  );
};
