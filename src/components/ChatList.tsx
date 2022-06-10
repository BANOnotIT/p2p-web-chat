import { Box, Text } from "@chakra-ui/react";
import { SyntheticEvent, useCallback } from "react";
import { ChatBuf } from "../protobuf/Chat.buf";

type Props = {
  chats: Array<{ id: number; name: string; buf: ChatBuf }>;
  selected: number;
  onSelect: (index: number) => void;
};

export const ChatList = (props: Props) => {
  const handleSelect = useCallback(
    (event: SyntheticEvent<HTMLElement>) => {
      if (isFinite(event.currentTarget.dataset["index"] as unknown as number)) {
        props.onSelect(Number(event.currentTarget.dataset["index"]));
      }
    },
    [props],
  );

  return (
    <>
      {props.chats.map((chat, i) => (
        <Box
          key={chat.id}
          data-index={i}
          bgColor={i === props.selected ? "blue.200" : ""}
          onClick={handleSelect}
          cursor={"pointer"}
          p={2}
        >
          <Text fontSize={"xl"}>{chat.name}</Text>
          <Text color={"gray.500"}>
            secret: {new TextDecoder().decode(chat.buf.sharedSecret)}
          </Text>
        </Box>
      ))}
    </>
  );
};
