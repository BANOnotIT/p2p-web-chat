import React, {
  createContext,
  ReactNode,
  SyntheticEvent,
  useCallback,
  useState,
} from "react";
import { ChatListStore } from "../services/ChatListStore";
import { ChatDatabase } from "../services/ChatDatabase";
import { AESCBCCryptor } from "../services/AESCBCCryptor";

export const ChatListContext = createContext<null | ChatListStore>(null);

type Props = { children: ReactNode };
export const ChatListStoreProvider = (props: Props) => {
  const [store, setStore] = useState<null | ChatListStore>(null);
  const [password, setPassword] = useState("");

  const handlePasswordSend = useCallback(async (event: SyntheticEvent) => {
    event.preventDefault();

    const enc = new TextEncoder();
    console.log(enc.encode(password));
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      true,
      ["deriveBits", "deriveKey"]
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
      ["encrypt", "decrypt"]
    );

    setStore(new ChatListStore(new ChatDatabase(), new AESCBCCryptor(rootKey)));
  }, []);

  if (store) {
    return (
      <ChatListContext.Provider value={store}>
        {props.children}
      </ChatListContext.Provider>
    );
  }

  return (
    <form onSubmit={handlePasswordSend}>
      <input
        type={"password"}
        value={password}
        onChange={(e) => setPassword(e.currentTarget.value)}
      />
      <input type={"submit"} />
    </form>
  );
};
