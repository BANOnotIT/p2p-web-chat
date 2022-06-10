import SimplePeer from "simple-peer";
import hypercore, { HyperCoreFeed, Peer } from "hypercore";
import { crc32 } from "crc";
import { Channel, MessageWrapperBuf } from "../protobuf/MessageWrapper.buf";
import { Readable, Transform, Writable } from "readable-stream";
import EventEmitter from "events";
import { AbstractRandomAccess } from "random-access-storage";
import { promisify } from "bluebird";
import { Emitter } from "../utils/eventemitter";

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
    }>
{
  public core: null | HyperCoreFeed<Buffer> = null;

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

    if (this.core.peers.every((peer) => peer.remoteOpened))
      return HyperCoreSyncStatus.online;

    if (this.core.peers.length !== 0) return HyperCoreSyncStatus.connecting;

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

    console.log("trying to setup sync channel", channelIdx);

    const alreadySetUp = await this.initializeCore();
    if (!alreadySetUp) {
      console.log("getting public key for", channelIdx);
      const publicKey = await this.askCorePublicKey(peer, channelIdx);
      await this.initializeCore(publicKey);
      console.log("got public key");
    }

    this.setupReplication(peer, channelIdx);
  }

  private async askCorePublicKey(
    peer: SimplePeer.Instance,
    channelIdx: number,
  ): Promise<Uint8Array> {
    const acquirer = new PublicKeyAcquirer();
    let filter = new FilterAndUnwrap(Channel.hyperCorePublicKey, channelIdx);

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

    this.core.on("peer-add", () => this.emit("status-change", this.status));
    this.core.on("peer-open", () => this.emit("status-change", this.status));
    this.core.on("peer-remove", () => this.emit("status-change", this.status));

    return new Promise((done) => this.core!.once("ready", () => done(true)));
  }

  private async setupReplication(peer: SimplePeer.Instance, channelId: number) {
    if (!this.core)
      throw new Error(
        "Replication setup called before hypercore was initialized",
      );

    this.peers.add(peer);

    const publicKeyLighthouse = new PublicKeyLighthouse(
      new Uint8Array(this.core.key),
      15_000,
    );
    publicKeyLighthouse
      .pipe(new WrapMessage(Channel.hyperCorePublicKey, channelId))
      .pipe(peer);
    peer.once("close", () => {
      publicKeyLighthouse.destroy();
    });

    let syncStream = this.core.replicate(this.isProducer, {
      live: true,
      timeout: 0,
      encrypted: false,
      download: true,
      upload: true,
    });
    syncStream
      .pipe(new LogBuffer("sent"))
      .pipe(new BufferToUint8Array())
      .pipe(new WrapMessage(Channel.userMessage, channelId))
      .pipe(peer)
      .pipe(new FilterAndUnwrap(Channel.userMessage, channelId))
      .pipe(new Uint8ArrayToBuffer())
      .pipe(new LogBuffer("received"))
      .pipe(syncStream);

    console.log("replication started", this);
  }
}

class WrapMessage extends Transform {
  constructor(private channel: Channel, private channelIdx: number) {
    super();
  }

  _transform(
    chunk: Uint8Array,
    encoding: BufferEncoding,
    callback: (err?: null | Error, data?: any) => void,
  ) {
    const wrapped = new MessageWrapperBuf();
    wrapped.idx = this.channelIdx;
    wrapped.channel = this.channel;
    wrapped.message = chunk;

    const wrappedBuffer = MessageWrapperBuf.encode(wrapped).finish();
    this.push(wrappedBuffer);

    callback(null);
  }
}

class FilterAndUnwrap extends Transform {
  constructor(private channel: Channel, private channelIdx: number) {
    super();
  }

  _transform(
    chunk: Uint8Array,
    encoding: BufferEncoding,
    callback: (err?: null | Error, data?: any) => void,
  ) {
    const unwrapped = MessageWrapperBuf.decode(chunk);
    if (unwrapped.idx === this.channelIdx && unwrapped.channel === this.channel)
      this.push(unwrapped.message);

    callback();
  }
}

class Uint8ArrayToBuffer extends Transform {
  _transform(
    chunk: Uint8Array,
    encoding: BufferEncoding,
    callback: (err?: null | Error, data?: any) => void,
  ) {
    this.push(Buffer.from(chunk));
    callback();
  }
}
class BufferToUint8Array extends Transform {
  _transform(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: (err?: null | Error, data?: any) => void,
  ) {
    this.push(Uint8Array.from(chunk));
    callback();
  }
}

class LogBuffer extends Transform {
  constructor(private prefix = "") {
    super();
  }

  _transform(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: (err?: null | Error, data?: any) => void,
  ) {
    this.push(chunk);
    console.log(this.prefix, chunk.toString("hex"));
    callback();
  }
}

class PublicKeyAcquirer extends Writable {
  private resolver!: (value: Uint8Array | PromiseLike<Uint8Array>) => void;
  readonly promise;

  constructor() {
    super();
    this.promise = new Promise<Uint8Array>((done) => (this.resolver = done));
  }

  _write(
    chunk: Uint8Array,
    _encoding: string,
    callback: (error?: Error | null) => void,
  ) {
    this.resolver(chunk);
    callback();
  }
}

class PublicKeyLighthouse extends Readable {
  private interval: null | number = null;

  constructor(private publicKey: Uint8Array, private period: number) {
    super();
  }

  sendPublicKey = () => {
    this.push(this.publicKey);
  };

  _read() {
    if (this.interval === null) {
      this.sendPublicKey();

      this.interval = setInterval(
        this.sendPublicKey,
        this.period,
      ) as unknown as number;
    }
  }

  _destroy(error: Error | null, callback: (error?: Error | null) => void) {
    super._destroy(error, callback);

    if (this.interval !== null) clearInterval(this.interval);

    callback();
  }
}
