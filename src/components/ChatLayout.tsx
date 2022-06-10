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
import { ChatBuf } from "../protobuf/Chat.buf";

export const ChatLayout = () => {
  const [chats, setChats] = useState<
    Array<{ id: number; name: string; buf: ChatBuf }>
  >([]);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedChatIndex, setSelectedChatIndex] = useState(0);
  const [chatStore, setChatStore] = useState<null | ChatStore>(null);

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
    onClose();
    setExternalSecret("");
    setNewChatName("");
  }, [chatList, externalSecret, newChatName, onClose]);

  useEffect(() => {
    let chat = chats[selectedChatIndex];
    if (!chatList || !chat) return;
    setChatStore(chatList.getChatStore(chat));
  }, [chatList, chats, selectedChatIndex]);

  return (
    <>
      <Box display={"flex"}>
        <Box width={"30ch"} display={"flex"} flexDir={"column"}>
          <Button
            onClick={onOpen}
            disabled={chatList === null}
            colorScheme={"green"}
            my={2}
            mx={1}
          >
            Create Chat
          </Button>
          <ChatList
            chats={chats}
            selected={selectedChatIndex}
            onSelect={setSelectedChatIndex}
          />
        </Box>
        {chatStore && <MessagesList chat={chatStore} key={chatStore.uuid} />}
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
