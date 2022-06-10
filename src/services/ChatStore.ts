import { ChatEntity, messagesRandomAccessDB } from "./ChatDatabase";
import { AESCBCCryptor } from "./AESCBCCryptor";
import { ChatBuf } from "../protobuf/Chat.buf";
import { UserMessageBuf } from "../protobuf/UserMessage.buf";
import { DiscoveryManager } from "./DiscoveryManager";
import { HypercoreSynchronize } from "./HypercoreSynchronize";
import Peer from "simple-peer";
import { promisify } from "bluebird";
import EventEmitter from "events";

export class ChatStore extends EventEmitter {
  private cryptor: AESCBCCryptor;

  private myMessagesSynchronize: HypercoreSynchronize;
  private theirMessagesSynchronize: HypercoreSynchronize;

  private chatInfoHash: null | string = null;

  constructor(
    private chatId: NonNullable<ChatEntity["id"]>,
    readonly name: string,
    private insides: ChatBuf,
    private discoveryMgr: DiscoveryManager,
  ) {
    super();
    this.cryptor = AESCBCCryptor.fromU8Array(insides.sharedSecret);

    const myStore = (filename: string) =>
      messagesRandomAccessDB(`chat-messages-${insides.uuid}:my-${filename}`);
    const theirStore = (filename: string) =>
      messagesRandomAccessDB(`chat-messages-${insides.uuid}:their-${filename}`);

    this.myMessagesSynchronize = new HypercoreSynchronize(
      myStore,
      "chat-messages",
      true,
      this.discoveryMgr.selfId,
    );

    this.theirMessagesSynchronize = new HypercoreSynchronize(
      theirStore,
      "chat-messages",
      false,
      this.discoveryMgr.selfId,
    );

    this.discoveryMgr.on("peer connected", this.peerConnectedListener);
  }

  destroy() {
    this.discoveryMgr.off("peer connected", this.peerConnectedListener);
    if (this.chatInfoHash) this.discoveryMgr.stopAnnouncing(this.chatInfoHash);

    this.theirMessagesSynchronize.stopAllPeers();
    this.myMessagesSynchronize.stopAllPeers();
  }

  get uuid() {
    return this.insides.uuid;
  }

  get sharedSecret() {
    return this.insides.sharedSecret;
  }

  async connectToPeers() {
    await this.myMessagesSynchronize.initializeCore();
    await this.discoveryMgr.connectToTrackers();
    this.chatInfoHash = await this.discoveryMgr.createAnnounce(
      this.insides.sharedSecret.toString(),
    );
  }

  async getMessages(): Promise<UserMessageBuf[]> {
    if (
      !this.myMessagesSynchronize.core ||
      this.myMessagesSynchronize.core?.length === 0 ||
      !this.myMessagesSynchronize.core?.readable
    ) {
      return [];
    }

    let messages = (await promisify(
      this.myMessagesSynchronize.core.getBatch,
    ).call(
      this.myMessagesSynchronize.core,
      0,
      this.myMessagesSynchronize.core.length,
    )) as Buffer[];

    if (this.theirMessagesSynchronize.core) {
      messages.push(
        ...((await promisify(this.theirMessagesSynchronize.core.getBatch).call(
          this.theirMessagesSynchronize.core,
          0,
          this.theirMessagesSynchronize.core.length,
        )) as Buffer[]),
      );
    }

    return Promise.all(
      messages?.map((message) => this.decryptMessage(Uint8Array.from(message))),
    );
  }

  async sendMessage(msg: UserMessageBuf) {
    const encryptedBlob = await this.encryptMessage(msg);

    return new Promise((done, error) => {
      this.myMessagesSynchronize.core!.append(
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
      this.theirMessagesSynchronize?.registerRTCPeer(peer, peerId);
    }
  };
}
