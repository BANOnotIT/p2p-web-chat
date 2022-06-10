import React, {
  createContext,
  ReactNode,
  SyntheticEvent,
  useCallback,
  useMemo,
  useState,
} from "react";
import { ChatListStore } from "../services/ChatListStore";
import { ChatDatabase } from "../services/ChatDatabase";
import { AESCBCCryptor } from "../services/AESCBCCryptor";
import { DiscoveryManager } from "../services/DiscoveryManager";
import { Button, Input } from "@chakra-ui/react";

export const ChatListContext = createContext<null | ChatListStore>(null);

type Props = { children: ReactNode };
export const ChatListStoreProvider = (props: Props) => {
  const [store, setStore] = useState<null | ChatListStore>(null);
  const [password, setPassword] = useState("");
  const discoveryManager = useMemo(
    () => new DiscoveryManager({ appId: "tester" }),
    [],
  );

  const handlePasswordSend = useCallback(
    async (event: SyntheticEvent) => {
      event.preventDefault();

      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        "PBKDF2",
        false,
        ["deriveBits", "deriveKey"],
      );

      let salt = enc.encode(`fdsaasdffasdfasdf+a78s4DFfasdfasAs`);
      const rootKey = await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          iterations: 100_000,
          hash: "SHA-256",
          salt,
        },
        keyMaterial,
        { name: "AES-CBC", length: 256 },
        true,
        ["encrypt", "decrypt"],
      );

      setStore(
        new ChatListStore(
          new ChatDatabase(),
          new AESCBCCryptor(rootKey),
          discoveryManager,
        ),
      );
    },
    [discoveryManager, password],
  );

  if (store) {
    return (
      <ChatListContext.Provider value={store}>
        {props.children}
      </ChatListContext.Provider>
    );
  }

  return (
    <form onSubmit={handlePasswordSend}>
      <Input
        type={"password"}
        value={password}
        onChange={(e) => setPassword(e.currentTarget.value)}
      />
      <Button type={"submit"}>Decrypt storage</Button>
    </form>
  );
};
