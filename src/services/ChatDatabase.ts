import Dexie from "dexie";
import randomAccess from "random-access-idb";

export interface ChatMessageEntity {
  readonly id?: number;
  nonce: string;
  chat: number;
  timestamp: Date;
  encryptedBlob: Uint8Array;
}

export interface ChatEntity {
  readonly id?: number;
  name: string;
  encryptedBlob: Uint8Array;
}

export class ChatDatabase extends Dexie {
  chats!: Dexie.Table<ChatEntity, number>;

  constructor() {
    super("p2pChatDatabase");
    this.version(1).stores({
      chats: "++id",
    });
  }
}
export const messagesRandomAccessDB = randomAccess("messagesDatabase");
