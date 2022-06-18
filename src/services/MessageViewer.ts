import { HyperCoreFeed } from "hypercore";
import EventEmitter from "events";
import { Mutex } from "async-mutex";
import { AESCBCCryptor } from "./AESCBCCryptor";
import { promisify } from "bluebird";
import { UserMessageBuf } from "../protobuf/UserMessage.buf";

export type ViewMessage = {
  fromParticipant: number;
  text: string;
  uuid: string;
};

export class MessageViewer extends EventEmitter {
  constructor(private cryptor: AESCBCCryptor) {
    super();
  }

  get messages() {
    return this._messages;
  }

  private _messages: ViewMessage[] = [];
  private cursorMutex = new Mutex();
  private cursors = new Map<
    HyperCoreFeed<Uint8Array>,
    { start: number; end: number; participant: number }
  >();

  reset() {
    this._messages = [];
    this.cursors.clear();
  }

  registerFeed(feed: HyperCoreFeed<Uint8Array>, participantId: number) {
    this.cursors.set(feed, {
      start: feed.length,
      end: feed.length,
      participant: participantId,
    });

    console.log("got feed", feed, participantId);

    feed.on("upload", () => {
      console.log("upload", participantId);
      this.updateHead().catch((err) => this.emit("error", err));
    });
    feed.on("ack", () => {
      console.log("ack", participantId);
      this.updateHead().catch((err) => this.emit("error", err));
    });
    feed.on("download", () => {
      console.log("download", participantId);
      this.updateHead().catch((err) => this.emit("error", err));
    });
    feed.on("sync", () => {
      console.log("sync", participantId);
      this.updateHead().catch((err) => this.emit("error", err));
    });
  }

  async updateTail(length: number, strictLength = false) {
    return this.cursorMutex.runExclusive(async () => {
      let appendLength = strictLength
        ? Math.max(0, length - this._messages.length)
        : length;

      const candidates = (
        await Promise.all(
          Array.from(this.cursors.entries()).map(async ([feed, cursor]) => {
            let minRange = Math.max(0, cursor.start - appendLength);
            const msgs = (await promisify(feed.getBatch).call(
              feed,
              minRange,
              cursor.start,
            )) as Uint8Array[];

            console.log([minRange, cursor.start], msgs, cursor.participant);

            return Promise.all(
              msgs.map(async (msg, i) => ({
                msg: await this.cryptor.decrypt(msg, UserMessageBuf),
                position: i + minRange,
                cursor,
              })),
            );
          }),
        )
      )
        .flat()
        .sort((a, b) => a.msg.senderTimestamp - b.msg.senderTimestamp);

      const toShow = candidates.slice(candidates.length - appendLength);
      toShow.forEach(({ cursor, position }) => {
        cursor.start = Math.min(cursor.start, position);
      });

      this._messages.unshift(
        ...toShow.map(
          (entry): ViewMessage => ({
            fromParticipant: entry.cursor.participant,
            text: entry.msg.text,
            uuid: entry.msg.nonce,
          }),
        ),
      );

      this.emit("ready");
    });
  }

  async updateHead() {
    return this.cursorMutex.runExclusive(async () => {
      const candidates = (
        await Promise.all(
          Array.from(this.cursors.entries()).map(async ([feed, cursor]) => {
            const msgs = (await promisify(feed.getBatch).call(
              feed,
              cursor.end,
              feed.length - 1,
            )) as Uint8Array[];

            return Promise.all(
              msgs.map(async (msg, i) => ({
                msg: await this.cryptor.decrypt(msg, UserMessageBuf),
                position: i + cursor.end,
                cursor,
              })),
            );
          }),
        )
      )
        .flat()
        .sort((a, b) => a.msg.senderTimestamp - b.msg.senderTimestamp);

      candidates.forEach(({ cursor, position }) => {
        cursor.end = Math.max(cursor.end, position);
      });

      this._messages.push(
        ...candidates.map(
          (entry): ViewMessage => ({
            fromParticipant: entry.cursor.participant,
            text: entry.msg.text,
            uuid: entry.msg.nonce,
          }),
        ),
      );

      this.emit("ready");
    });
  }
}
