import { ChatEntity, messagesRandomAccessDB } from "./ChatDatabase";
import { AESCBCCryptor } from "./AESCBCCryptor";
import { ChatBuf } from "../protobuf/Chat.buf";
import { UserMessageBuf } from "../protobuf/UserMessage.buf";
import { DiscoveryManager } from "./DiscoveryManager";
import {
  HypercoreSynchronize,
  HyperCoreSyncStatus,
} from "./HypercoreSynchronize";
import Peer from "simple-peer";
import EventEmitter from "events";
import { MessageViewer } from "./MessageViewer";
import { HyperCoreFeed } from "hypercore";
import { promisify } from "bluebird";

export class ChatStore extends EventEmitter {
  private readonly cryptor: AESCBCCryptor;
  private readonly messageViewer: MessageViewer;

  private readonly myMessagesSynchronize: HypercoreSynchronize;
  private readonly theirMessagesSynchronize: HypercoreSynchronize;

  private chatInfoHash: null | string = null;

  constructor(
    private chatId: NonNullable<ChatEntity["id"]>,
    readonly name: string,
    private insides: ChatBuf,
    private discoveryMgr: DiscoveryManager,
  ) {
    super();
    this.cryptor = AESCBCCryptor.fromU8Array(insides.sharedSecret);

    this.messageViewer = new MessageViewer(this.cryptor);

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
    this.messageViewer.on("ready", () => this.emit("messages-updated"));

    this.myMessagesSynchronize.on("status-change", () => {
      this.emit("online-change", this.onlineStatus);
    });
    this.myMessagesSynchronize.once(
      "core-initialized",
      (core: HyperCoreFeed<Uint8Array>) => {
        this.messageViewer.registerFeed(core, 0);
        void this.requestInitialMessages(10);
      },
    );

    this.theirMessagesSynchronize.on("status-change", () =>
      this.emit("online-change", this.onlineStatus),
    );
    this.theirMessagesSynchronize.once(
      "core-initialized",
      (core: HyperCoreFeed<Uint8Array>) => {
        this.messageViewer.registerFeed(core, 1);
        void this.requestInitialMessages(10);
      },
    );

    this.on("online-change", () => {
      console.log("Online status: ", HyperCoreSyncStatus[this.onlineStatus]);
    });
  }

  get messages() {
    return this.messageViewer.messages;
  }

  get onlineStatus(): HyperCoreSyncStatus {
    const statuses = [
      this.myMessagesSynchronize.status,
      this.theirMessagesSynchronize.status,
    ] as number[];

    if (statuses.some((stat) => stat === HyperCoreSyncStatus.initializing))
      return HyperCoreSyncStatus.initializing;

    if (statuses.some((stat) => stat === HyperCoreSyncStatus.connecting))
      return HyperCoreSyncStatus.connecting;

    return Math.min(...statuses) as HyperCoreSyncStatus;
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
    await this.theirMessagesSynchronize.initializeCore();
    await this.discoveryMgr.connectToTrackers();
    this.chatInfoHash = await this.discoveryMgr.createAnnounce(
      this.insides.sharedSecret.toString(),
    );
  }

  async sendMessage(msg: UserMessageBuf) {
    const encryptedBlob = await this.encryptMessage(msg);

    await promisify(this.myMessagesSynchronize.core!.append).call(
      this.myMessagesSynchronize.core!,
      Buffer.from(encryptedBlob),
    );

    await this.messageViewer.updateHead();
  }

  async decryptMessage(entity: Uint8Array): Promise<UserMessageBuf> {
    return this.cryptor.decrypt(entity, UserMessageBuf);
  }

  async encryptMessage(entity: UserMessageBuf): Promise<Uint8Array> {
    const encoded = UserMessageBuf.encode(entity).finish();
    return this.cryptor.encrypt(encoded);
  }

  async requestTailMessages(count: number) {
    return this.messageViewer.updateTail(count);
  }
  async requestInitialMessages(count: number) {
    return this.messageViewer.updateTail(count, true);
  }

  private peerConnectedListener = async ({
    peer,
    infoHash,
    peerId,
  }: {
    peer: Peer.Instance;
    infoHash: string;
    peerId: string;
  }) => {
    if (infoHash !== this.chatInfoHash) return;

    await Promise.all([
      this.myMessagesSynchronize.registerRTCPeer(peer, peerId),
      this.theirMessagesSynchronize.registerRTCPeer(peer, peerId),
    ]);

    await this.requestInitialMessages(10);
    return;
  };
}
