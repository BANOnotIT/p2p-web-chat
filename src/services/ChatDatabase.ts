import Dexie from "dexie";

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
  messages!: Dexie.Table<ChatMessageEntity, number>;

  constructor() {
    super("p2pChatDatabase");
    this.version(1).stores({
      messages: "++id, &nonce, timestamp, chat",
      chats: "++id",
    });
  }
}
