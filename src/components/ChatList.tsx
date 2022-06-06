import { ChatStore } from "../services/ChatStore";
import { Box, Text } from "@chakra-ui/react";
import { SyntheticEvent, useCallback } from "react";

type Props = {
  chats: ChatStore[];
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
    <div>
      {props.chats.map((chat, i) => (
        <Box
          key={chat.uuid}
          data-index={i}
          bgColor={i === props.selected ? "blue.200" : ""}
          onClick={handleSelect}
          cursor={"pointer"}
        >
          <Text fontSize={"xl"}>{chat.name}</Text>
          <Text color={"gray.500"}>
            secret: {new TextDecoder().decode(chat.sharedSecret)}
          </Text>
        </Box>
      ))}
    </div>
  );
};
