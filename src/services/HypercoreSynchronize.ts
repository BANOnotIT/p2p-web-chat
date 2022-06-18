import SimplePeer from "simple-peer";
import hypercore, { HyperCoreFeed, Peer } from "hypercore";
import { crc32 } from "crc";
import { Channel } from "../protobuf/MessageWrapper.buf";
import EventEmitter from "events";
import { AbstractRandomAccess } from "random-access-storage";
import { promisify } from "bluebird";
import { Emitter } from "../utils/eventemitter";
import {
  BinaryTransformer,
  MessageLighthouse,
  MessageResolver,
  UnwrapAndFilterMessage,
  WrapMessage,
} from "../utils/stream";

export enum HyperCoreSyncStatus {
  notInitialized,
  initializing,
  connecting,
  online,
}

export class HypercoreSynchronize
  extends EventEmitter
  implements
    Emitter<{
      "status-change": HyperCoreSyncStatus;
      "core-initialized": HyperCoreFeed<Uint8Array>;
    }>
{
  public core: null | HyperCoreFeed<Uint8Array> = null;

  constructor(
    private store: (filename: string) => AbstractRandomAccess,
    private storeCanonicalName: string,
    private isProducer: boolean,
    private myId: string,
  ) {
    super();
  }

  private peers = new Map<Peer, SimplePeer.Instance>();

  get status(): HyperCoreSyncStatus {
    if (!this.core) return HyperCoreSyncStatus.notInitialized;

    if (this.core.peers.length !== 0) {
      const everyPeerOpened = this.core.peers.every(
        (peer) => peer.remoteOpened,
      );

      if (everyPeerOpened) return HyperCoreSyncStatus.online;
      else return HyperCoreSyncStatus.connecting;
    }

    return HyperCoreSyncStatus.initializing;
  }

  stopAllPeers() {
    this.peers.forEach((peer) => {
      peer.destroy();
    });
  }

  async registerRTCPeer(peer: SimplePeer.Instance, peerId: string) {
    const direction = [this.myId, peerId];
    const channelIdx = crc32(
      `${this.storeCanonicalName}:${
        this.isProducer ? direction.join(",") : direction.reverse().join(",")
      }`,
    );

    const alreadySetUp = await this.initializeCore();
    if (!alreadySetUp) {
      const publicKey = await this.askCorePublicKey(peer, channelIdx);
      await this.initializeCore(publicKey);
    }

    await this.setupLighthouse(peer, channelIdx);
    await this.setupReplication(peer, channelIdx);
  }

  private async askCorePublicKey(
    peer: SimplePeer.Instance,
    channelIdx: number,
  ): Promise<Uint8Array> {
    const acquirer = new MessageResolver();
    let filter = new UnwrapAndFilterMessage(
      Channel.hyperCorePublicKey,
      channelIdx,
    );

    peer.pipe(filter).pipe(acquirer);

    const publicKey = await acquirer.promise;

    filter.unpipe(acquirer);
    peer.unpipe(filter);

    return publicKey;
  }

  async initializeCore(publicKey?: Uint8Array) {
    // check storage has public key
    let publicKeyFile = this.store("key");
    const stats = await promisify(publicKeyFile.stat).call(publicKeyFile);

    if (stats?.size === 0 && !publicKey && !this.isProducer) return false;

    this.core = publicKey
      ? hypercore(this.store, Buffer.from(publicKey), { sparse: false })
      : hypercore(this.store, { sparse: false });
    const core = this.core;

    core.on("peer-add", () => this.emit("status-change", this.status));
    core.on("peer-open", () => this.emit("status-change", this.status));
    core.on("peer-remove", () => this.emit("status-change", this.status));

    await new Promise((done) => core.once("ready", () => done(null)));
    this.emit("core-initialized", core);

    return true;
  }

  private async setupReplication(peer: SimplePeer.Instance, channelId: number) {
    if (!this.core)
      throw new Error(
        "Replication setup called before hypercore was initialized",
      );

    const syncStream = this.core.replicate(this.isProducer, {
      live: true,
      encrypted: false,
      download: true,
      upload: true,
      ack: true,
    });

    syncStream.once("error", (err) => {
      console.log(err);
      if (err.message === "ETIMEDOUT" && !peer.destroyed) {
        console.debug("trying to reconnect");
        setTimeout(this.setupReplication.bind(this), 0, peer, channelId);
      }
    });

    syncStream
      .pipe(BinaryTransformer.bufferToUint8Array())
      .pipe(new WrapMessage(Channel.userMessage, channelId))
      .pipe(peer)
      .pipe(new UnwrapAndFilterMessage(Channel.userMessage, channelId))
      .pipe(BinaryTransformer.uint8ArrayToBuffer())
      .pipe(syncStream);

    console.debug("replication started", this);
  }

  private setupLighthouse(peer: SimplePeer.Instance, channelId: number) {
    if (!this.core)
      throw new Error(
        "Lighthouse setup called before hypercore was initialized",
      );

    const publicKeyLighthouse = new MessageLighthouse(
      new Uint8Array(this.core.key),
      15_000,
    );
    publicKeyLighthouse
      .pipe(new WrapMessage(Channel.hyperCorePublicKey, channelId))
      .pipe(peer);

    peer.once("close", () => {
      publicKeyLighthouse.destroy();
    });
  }
}
