declare module "hypercore" {
  import { AbstractRandomAccess } from "random-access-storage";
  import Buffer from "node:buffer";

  type GetOptions = Partial<{
    wait: boolean;
    onwait: () => void;
    timeout: number;
    valueEncoding: "json" | "binary" | "utf-8";
  }>;

  type FeedStats = {
    uploadedBytes: number;
    uploadedBlocks: number;
    downloadedBytes: number;
    downloadedBlocks: number;
  };

  interface ReplicationExtension<T> {
    send(message: T, peer: Peer);
    broadcast(message: T);
  }

  export interface HyperCoreFeed<T> extends NodeJS.EventEmitter {
    append(data: T, cb?: PublicCallback<number>);

    get(index: number, cb: PublicCallback<T>): number;
    get(index: number, options: GetOptions, cb: PublicCallback<T>): number;
    getBatch(start: number, end: number, cb: PublicCallback<T[]>): number;
    getBatch(
      start: number,
      end: number,
      options: Omit<GetOptions, "onwait">,
      cb: PublicCallback<T[]>,
    ): number;

    cancel(getId: number);

    head(cb: PublicCallback<T>);
    head(options: GetOptions, cb: PublicCallback<T>);

    download(cb?: PublicCallback): number;
    download(
      range?:
        | { blocks: number[] }
        | { start: number; end: number; linear?: boolean },
      cb?: PublicCallback,
    ): number;

    undownload(downloadId: number);

    signature(cb: PublicCallback<{ index: number; signature: Buffer }>);
    signature(
      index: number,
      cb: PublicCallback<{ index: number; signature: Buffer }>,
    );

    verify(index: number, signature: Buffer, cb: PublicCallback<boolean>);

    rootHashes(
      index: number,
      cb: PublicCallback<Array<{ index: number; size: number; hash: Buffer }>>,
    );

    // TODO check
    downloaded(start?: number, end?: number): number;

    has(index: number): boolean;
    has(start: number, end: number): boolean;

    clear(start: number, cb?: PublicCallback);
    clear(start: number, end: number, cb?: PublicCallback);

    seek(
      byteOffset: number,
      options:
        | ((err: null, index: number, relativeOffset: number) => void)
        | ((err: Error) => void),
    );

    update(cb?: PublicCallback);
    update(minLength: number, cb?: PublicCallback);
    update(
      opts: { ifAvailable?: boolean; minLength?: number },
      cb?: PublicCallback,
    );

    setDownloading(downloadFromOtherPeers: boolean);
    setUploading(uploadToOtherPeers: boolean);

    createReadableStream(
      opts?: Partial<{
        start: number;
        end: number;
        snapshot: boolean;
        tail: boolean;
        live: boolean;
        timeout: number;
        wait: boolean;
        batch: number;
      }>,
    ): NodeJS.ReadableStream;

    createWritableStream(
      opts?: Partial<{
        maxBlockSize: number;
      }>,
    ): NodeJS.WritableStream;

    replicate(
      isInitiator: boolean,
      opts?: Partial<{
        live: boolean;
        ack: boolean;
        download: boolean;
        upload: boolean;
        encrypted: boolean;
        noise: boolean;
        keyPair: { publicKey: Buffer; secretKey: Buffer };

        onauthenticate(remotePublicKey: Buffer, done: boolean);
        onfeedauthenticate(feed: this, remotePublicKey: Buffer, done: boolean);

        timeout: number;
      }>,
    ): NodeJS.ReadWriteStream;

    on(
      event: "ack",
      cb: (ack: { start: number; length: number }) => void,
    ): this;

    close(cb?: PublicCallback);

    destroyStorage(cb?: PublicCallback);

    audit(cb?: (data: { valid: number; invalid: number }) => void);

    writable: boolean;
    readable: boolean;

    key: Buffer;
    discoveryKey: Buffer;

    length: number;
    byteLength: number;

    stats: {
      total: FeedStats;
      peers: FeedStats[];
    };

    on(event: "peer-add", cb: (peer: Peer) => void): this;
    on(event: "peer-remove", cb: (peer: Peer) => void): this;
    on(event: "peer-open", cb: (peer: Peer) => void): this;

    peers: Peer[];

    registerExtension<T extends ReplicationExtension>(
      name: string,
      handlers: {
        encoding: "json" | "binary" | "utf-8" | string;
        onmessage(message: unknown, peer: Peer);
        onerror(err: Error);
      },
    ): T;

    on(event: "ready" | "append" | "sync" | "close", cb: () => void);
    on(event: "error", cb: (err: Error) => void);
    on(event: "download" | "upload", cb: (index: number, data: T) => void);

    once(event: "ready" | "append" | "sync" | "close", cb: () => void);
    once(event: "error", cb: (err: Error) => void);
    once(event: "download" | "upload", cb: (index: number, data: T) => void);
  }

  export class Peer {
    publicKey: Buffer;
    sparse: boolean;
    live: boolean;

    remoteOpened: boolean;
    remoteLength: number;
    remoteAck: boolean;
    remoteUploading: boolean;
    remoteDownloading: boolean;
    remoteWant: boolean;
    // TODO find out
    remoteTree: unknown;
    remotePublicKey: Buffer;
    // TODO find out
    remoteAddress?: unknown;
    remoteType: string;

    uploading: boolean;
    downloading: boolean;
    updated: boolean;

    urgentRequests: number;
  }

  type PublicCallback<T = undefined> =
    | ((err: null, result: T) => void)
    | ((err: Error, result: null) => void);

  type FabricOptions<T> = {
    createIfMissing: boolean;
    overwrite: boolean;
    valueEncoding: "json" | "utf-8" | "binary";
    sparse: boolean;
    eagerUpdate: boolean;
    secretKey: Buffer;
    storeSecretKey: boolean;
    storageCacheSize: number;
    onwrite: (index: number, data: T, peer: Peer, cb: PublicCallback) => void;
    stats: boolean;
    crypto: Partial<{
      sign(data: Buffer, secretKey: Buffer, cb: PublicCallback<Buffer>);
      verify(signature: Buffer, data: Buffer, key, cb: PublicCallback<boolean>);
    }>;
    noiseKeyPair: { publicKey: Buffer; secretKey: Buffer };
  };

  function hypercore<T>(
    store: ((filename: string) => AbstractRandomAccess) | string,
    options?: Partial<FabricOptions<T>>,
  ): HyperCoreFeed<T>;
  function hypercore<T>(
    store: ((filename: string) => AbstractRandomAccess) | string,
    key: Buffer,
    options?: Partial<FabricOptions<T>>,
  ): HyperCoreFeed<T>;

  export default hypercore;
}
