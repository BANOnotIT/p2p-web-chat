import Peer from "simple-peer";
import { HyperCoreFeed } from "hypercore";
import { crc32 } from "crc";
import { Channel, MessageWrapperBuf } from "../protobuf/MessageWrapper.buf";
import { Transform } from "readable-stream";

export class HypercoreSynchronize {
  constructor(
    private store: HyperCoreFeed<unknown>,
    private storeCanonicalName: string,
    private isInitiator: boolean,
    private myId: string,
  ) {}

  registerRTCPeer(peer: Peer.Instance, peerId: string) {
    const direction = [this.myId, peerId];
    const channelId = crc32(
      `${this.storeCanonicalName}:${
        this.isInitiator ? direction.join(",") : direction.reverse().join(",")
      }`,
    );

    let syncStream = this.store.replicate(this.isInitiator, { live: true });

    syncStream
      .pipe(new WrapMessage(channelId))
      .pipe(peer)
      .pipe(new FilterAndUnwrap(channelId))
      .pipe(syncStream);
  }
}

class WrapMessage extends Transform {
  constructor(private channelIdx: number) {
    super();
  }

  _transform(
    chunk: Uint8Array,
    encoding: BufferEncoding,
    callback: (err?: null | Error, data?: any) => void,
  ) {
    const wrappedMessage = new MessageWrapperBuf();
    wrappedMessage.idx = this.channelIdx;
    wrappedMessage.channel = Channel.userMessage;
    wrappedMessage.message = chunk;

    const wrappedBuffer = MessageWrapperBuf.encode(wrappedMessage).finish();

    callback(null, wrappedBuffer);
  }
}

class FilterAndUnwrap extends Transform {
  constructor(private channelIdx: number) {
    super();
  }

  _transform(
    chunk: Uint8Array,
    encoding: BufferEncoding,
    callback: (err?: null | Error, data?: any) => void,
  ) {
    const wrapped = MessageWrapperBuf.decode(chunk);
    if (
      wrapped.idx === this.channelIdx &&
      wrapped.channel === Channel.userMessage
    )
      this.push(wrapped.message);

    callback();
  }
}
