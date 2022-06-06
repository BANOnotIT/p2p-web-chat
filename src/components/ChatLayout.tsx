import { ChatStore } from "../services/ChatStore";
import { useCallback, useContext, useEffect, useState } from "react";
import { ChatList } from "./ChatList";
import { ChatListContext } from "./ChatListStoreProvider";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputRightAddon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useDisclosure,
} from "@chakra-ui/react";
import { genId } from "../utils/torrent";
import { MessagesList } from "./MessagesList";

export const ChatLayout = () => {
  const [chats, setChats] = useState<Array<ChatStore>>([]);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedChatIndex, setSelectedChatIndex] = useState(0);

  const chatList = useContext(ChatListContext);

  const [externalSecret, setExternalSecret] = useState("");
  const [newChatName, setNewChatName] = useState("");

  useEffect(() => {
    const refreshChats = () => {
      chatList?.getChats().then((chats) => {
        setChats(chats);
      });
    };
    chatList?.on("new chat", refreshChats);

    refreshChats();

    return () => {
      chatList?.off("new chat", refreshChats);
    };
  }, [chatList]);

  const generateRandomSecret = useCallback(() => {
    setExternalSecret(genId(15));
  }, []);
  const createChat = useCallback(() => {
    chatList?.createChat(newChatName, externalSecret);
  }, [chatList, externalSecret, newChatName]);

  return (
    <>
      <Box display={"flex"}>
        <Box width={"30ch"}>
          <Button
            onClick={onOpen}
            disabled={chatList === null}
            colorScheme={"green"}
          >
            Create Chat
          </Button>
          <ChatList
            chats={chats}
            selected={selectedChatIndex}
            onSelect={setSelectedChatIndex}
          />
        </Box>
        {chats[selectedChatIndex] && (
          <MessagesList chat={chats[selectedChatIndex]} />
        )}
      </Box>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Modal Title</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl>
              <FormLabel>Chat name</FormLabel>
              <Input
                value={newChatName}
                onChange={(e) => setNewChatName(e.currentTarget.value)}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Secret</FormLabel>
              <InputGroup>
                <Input
                  value={externalSecret}
                  onChange={(e) => setExternalSecret(e.currentTarget.value)}
                />
                <InputRightAddon padding={"0"}>
                  <Button onClick={generateRandomSecret}>
                    Generate random
                  </Button>
                </InputRightAddon>
              </InputGroup>
            </FormControl>
          </ModalBody>

          <ModalFooter>
            <Button mr={3} onClick={onClose}>
              Close
            </Button>
            <Button
              disabled={externalSecret.length === 0 || newChatName.length === 0}
              colorScheme={"green"}
              onClick={createChat}
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
