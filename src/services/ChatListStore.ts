import { ChatDatabase } from "./ChatDatabase";
import { AESCBCCryptor } from "./AESCBCCryptor";
import { ChatStore } from "./ChatStore";
import { ChatBuf } from "../protobuf/Chat.buf";
import { v5 } from "uuid";

export class ChatListStore {
  constructor(private db: ChatDatabase, private cryptor: AESCBCCryptor) {}

  async getChats(): Promise<ChatStore[]> {
    let selector = this.db.chats;

    const results = await selector.toArray();

    return Promise.all(
      results.map(
        async (chat) =>
          new ChatStore(
            chat.id!,
            await this.cryptor.decrypt(chat.encryptedBlob, ChatBuf),
          )
      )
    );
  }

  async createChat(name: string, sharedSecret: string) {
    const enc = new TextEncoder();
    const buf = new ChatBuf();
    buf.sharedSecret = enc.encode(sharedSecret);
    buf.uuid = v5(buf.sharedSecret, "chat");

    const encrypted = await this.cryptor.encrypt(ChatBuf.encode(buf).finish());

    return this.db.chats.add({
      encryptedBlob: encrypted,
      name,
    });
  }
}
