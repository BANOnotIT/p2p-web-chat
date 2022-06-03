import { ChatDatabase, ChatEntity } from "./ChatDatabase";
import { AESCBCCryptor } from "./AESCBCCryptor";
import { ChatBuf } from "../protobuf/Chat.buf";
import { UserMessageBuf } from "../protobuf/UserMessage.buf";

export class ChatStore {
  private cryptor: AESCBCCryptor;

  constructor(
    private chatId: NonNullable<ChatEntity["id"]>,
    private insides: ChatBuf,
    private db: ChatDatabase
  ) {
    this.cryptor = AESCBCCryptor.fromU8Array(insides.sharedSecret);
  }

  async getMessages(): Promise<UserMessageBuf[]> {
    const selector = this.db.messages;

    const result = await selector.toArray();

    return Promise.all(
      result.map((msg) => this.decryptMessage(msg.encryptedBlob))
    );
  }

  async saveMessage(msg: UserMessageBuf) {
    const encryptedBlob = await this.encryptMessage(msg);

    this.db.messages.add({
      chat: this.chatId,
      encryptedBlob,
      nonce: msg.nonce,
      timestamp: msg.timestamp,
    });
  }

  async decryptMessage(entity: Uint8Array): Promise<UserMessageBuf> {
    return this.cryptor.decrypt(entity, UserMessageBuf);
  }

  async encryptMessage(entity: UserMessageBuf): Promise<Uint8Array> {
    const encoded = UserMessageBuf.encode(entity).finish();
    return this.cryptor.encrypt(encoded);
  }
}
