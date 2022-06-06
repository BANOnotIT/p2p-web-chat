import { ChatEntity, messagesRandomAccessDB } from "./ChatDatabase";
import { AESCBCCryptor } from "./AESCBCCryptor";
import { ChatBuf } from "../protobuf/Chat.buf";
import { UserMessageBuf } from "../protobuf/UserMessage.buf";
import hypercore, { HyperCoreFeed } from "hypercore";

export class ChatStore {
  private cryptor: AESCBCCryptor;
  private myMessagesCore: HyperCoreFeed<Buffer>;
  private theirMessagesCore: HyperCoreFeed<Buffer>;

  constructor(
    private chatId: NonNullable<ChatEntity["id"]>,
    private insides: ChatBuf
  ) {
    this.cryptor = AESCBCCryptor.fromU8Array(insides.sharedSecret);

    const myStore = messagesRandomAccessDB(`chat-messages-${insides.uuid}:my`);
    const theirStore = messagesRandomAccessDB(
      `chat-messages-${insides.uuid}:their`
    );

    this.myMessagesCore = hypercore(myStore);
    this.theirMessagesCore = hypercore(theirStore);
  }

  async getMessages(): Promise<UserMessageBuf[]> {
    return [];
  }

  async sendMessage(msg: UserMessageBuf) {
    const encryptedBlob = await this.encryptMessage(msg);

    return new Promise((done, error) => {
      this.myMessagesCore.append(
        Buffer.from(encryptedBlob),
        (err: null | Error) => {
          if (err) return error(err);
          done(encryptedBlob);
        }
      );
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
