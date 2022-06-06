import { ChatEntity, messagesRandomAccessDB } from "./ChatDatabase";
import { AESCBCCryptor } from "./AESCBCCryptor";
import { ChatBuf } from "../protobuf/Chat.buf";
import { UserMessageBuf } from "../protobuf/UserMessage.buf";
import hypercore, { HyperCoreFeed } from "hypercore";
import { DiscoveryManager } from "./DiscoveryManager";
import { HypercoreSynchronize } from "./HypercoreSynchronize";
import Peer from "simple-peer";

export class ChatStore {
  private cryptor: AESCBCCryptor;
  private myMessagesCore: HyperCoreFeed<Buffer>;
  private theirMessagesCore: HyperCoreFeed<Buffer>;

  private myMessagesSynchronize: HypercoreSynchronize;
  private theirMessagesSynchronize: HypercoreSynchronize;

  private chatInfoHash: null | string = null;

  constructor(
    private chatId: NonNullable<ChatEntity["id"]>,
    private insides: ChatBuf,
    private discoveryMgr: DiscoveryManager,
  ) {
    this.cryptor = AESCBCCryptor.fromU8Array(insides.sharedSecret);

    const myStore = (filename: string) =>
      messagesRandomAccessDB(`chat-messages-${insides.uuid}:my-${filename}`);
    const theirStore = (filename: string) =>
      messagesRandomAccessDB(`chat-messages-${insides.uuid}:their-${filename}`);

    this.myMessagesCore = hypercore(myStore);
    this.theirMessagesCore = hypercore(theirStore);

    this.myMessagesSynchronize = new HypercoreSynchronize(
      this.myMessagesCore,
      "chat-messages",
      true,
      this.discoveryMgr.selfId,
    );
    this.theirMessagesSynchronize = new HypercoreSynchronize(
      this.theirMessagesCore,
      "chat-messages",
      false,
      this.discoveryMgr.selfId,
    );

    this.discoveryMgr.on("peer connected", this.peerConnectedListener);
  }

  destroy() {
    this.discoveryMgr.off("peer connected", this.peerConnectedListener);
  }

  async connectToPeers() {
    this.chatInfoHash = await this.discoveryMgr.createAnnounce(
      this.insides.sharedSecret.toString(),
    );
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
        },
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

  private peerConnectedListener = ({
    peer,
    infoHash,
    peerId,
  }: {
    peer: Peer.Instance;
    infoHash: string;
    peerId: string;
  }) => {
    if (infoHash === this.chatInfoHash) {
      this.myMessagesSynchronize.registerRTCPeer(peer, peerId);
      this.theirMessagesSynchronize.registerRTCPeer(peer, peerId);
    }
  };
}
