import { ChatDatabase } from "./ChatDatabase";
import { AESCBCCryptor } from "./AESCBCCryptor";
import { ChatStore } from "./ChatStore";
import { ChatBuf } from "../protobuf/Chat.buf";
import { NIL, v5 } from "uuid";
import { DiscoveryManager } from "./DiscoveryManager";
import EventEmitter from "events";

const CHAT_NAMESPACE = v5("chat", NIL);

export class ChatListStore extends EventEmitter {
  constructor(
    private db: ChatDatabase,
    private cryptor: AESCBCCryptor,
    private discoveryManager: DiscoveryManager,
  ) {
    super();
  }

  getChatStore(chat: { buf: ChatBuf; id: number; name: string }) {
    return new ChatStore(chat.id!, chat.name, chat.buf, this.discoveryManager);
  }

  async getChats(): Promise<Array<{ buf: ChatBuf; id: number; name: string }>> {
    let selector = this.db.chats;

    const results = await selector.toArray();

    return Promise.all(
      results.map(async (chat) => ({
        ...chat,
        id: chat.id!,
        buf: await this.cryptor.decrypt(chat.encryptedBlob, ChatBuf),
      })),
    );
  }

  async createChat(name: string, sharedSecret: string) {
    const enc = new TextEncoder();
    const buf = new ChatBuf();
    buf.sharedSecret = enc.encode(sharedSecret);
    buf.uuid = v5(buf.sharedSecret, CHAT_NAMESPACE);
    const encrypted = await this.cryptor.encrypt(ChatBuf.encode(buf).finish());

    await this.db.chats.add({
      encryptedBlob: encrypted,
      name,
    });
    this.emit("new chat");
  }
}
