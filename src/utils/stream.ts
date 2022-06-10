import { Readable, Transform, Writable } from "readable-stream";
import { Channel, MessageWrapperBuf } from "../protobuf/MessageWrapper.buf";

export class BinaryTransformer {
  static uint8ArrayToBuffer() {
    return new (class Uint8ArrayToBuffer extends Transform {
      _transform(
        chunk: Uint8Array,
        encoding: BufferEncoding,
        callback: (err?: null | Error, data?: any) => void,
      ) {
        this.push(Buffer.from(chunk));
        callback();
      }
    })();
  }
  static bufferToUint8Array() {
    return new (class BufferToUint8Array extends Transform {
      _transform(
        chunk: Buffer,
        encoding: BufferEncoding,
        callback: (err?: null | Error, data?: any) => void,
      ) {
        this.push(Uint8Array.from(chunk));
        callback();
      }
    })();
  }
}

export class WrapMessage extends Transform {
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

export class UnwrapAndFilterMessage extends Transform {
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

export class LogBuffer extends Transform {
  constructor(private prefix = "") {
    super();
  }

  _transform(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: (err?: null | Error, data?: any) => void,
  ) {
    this.push(chunk);
    console.info(this.prefix, chunk.toString("hex"));
    callback();
  }
}

export class MessageResolver extends Writable {
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

export class MessageLighthouse extends Readable {
  private interval: null | number = null;

  constructor(private message: Uint8Array, private period: number) {
    super();
  }

  signalMessage = () => {
    this.push(this.message);
  };

  _read() {
    if (this.interval === null) {
      this.signalMessage();

      // TODO tell to typescript we're not in node.js
      this.interval = setInterval(
        this.signalMessage,
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
