import {
  encodeBytes,
  entries,
  events,
  fromEntries,
  genId,
  initPeer,
  libName,
  selfId,
} from "./utils";
import { decrypt, encrypt, genKey } from "./crypto";
import Peer from "simple-peer-light";
import { EventEmitter } from "events";

const INFO_HASH_SIZE = 20;
const offerPoolSize = 10;
const defaultAnnounceSecs = 33;
const maxAnnounceSecs = 120;
const TRACKER_ACTION = "announce";
const defaultTrackerUrls = [
  "wss://tracker.openwebtorrent.com",
  "wss://tracker.btorrent.xyz",
  "wss://tracker.files.fm:7073/announce",
  "wss://spacetradersapi-chatbox.herokuapp.com:443/announce",
];

type Config = {
  trackerUrls?: string[];
  trackerRedundancy?: number;
  appId: string;
  rtcConfig?: RTCConfiguration;
};

export class DiscoveryManager extends EventEmitter {
  readonly version = "0.1.0";
  private trackerUrls: string[];
  private rtcConfig?: RTCConfiguration;
  readonly selfId = genId(INFO_HASH_SIZE);

  private externalHandledOffers = new Set<string>();
  private connectedPeers = new Map<string, Peer.Instance>();
  private sockets = new Map<string, WebSocket>();
  private announcements = new Map<
    string,
    {
      key: Promise<CryptoKey>;
      intervalId: number;
      intervalSec: number;
      offers: Record<
        string,
        {
          acquired: boolean;
          signalP: Promise<Peer.SignalData>;
          peer: Peer.Instance;
        }
      >;
    }
  >();

  constructor(config: Config) {
    super();
    this.trackerUrls = config.trackerUrls || defaultTrackerUrls;
    this.rtcConfig = config.rtcConfig;
  }

  destroy() {
    Array.from(this.sockets.values()).forEach((socket) => socket.close());
    Array.from(this.announcements.values())
      .flatMap((announce) => Object.values(announce.offers))
      .forEach((offer) => {
        offer.peer.destroy();
      });
    Array.from(this.connectedPeers.values()).forEach((a) => a.destroy());

    this.sockets.clear();
    this.announcements.clear();
    this.externalHandledOffers.clear();
    this.connectedPeers.clear();
  }

  private async handleTrackerMessage(socketId: string, message: MessageEvent) {
    const socket = this.sockets.get(socketId)!;
    type WebTorrentMessage = {
      info_hash: string;
      peer_id: string;
      ["failure reason"]?: string;
      interval?: number;
      offer: Peer.SignalData;
      offer_id: string;
      answer?: Peer.SignalData;
    };

    let msg: WebTorrentMessage;
    try {
      msg = JSON.parse(message.data);
    } catch (e) {
      console.error(`${libName}: Malformed SDP`, e);
      return;
    }

    if (!this.announcements.has(msg.info_hash) || this.selfId === msg.peer_id)
      return;

    const failure = msg["failure reason"];

    if (failure) {
      console.warn(`${libName}: torrent tracker failure (${failure})`);
      return;
    }

    const announce = this.announcements.get(msg.info_hash)!;

    if (
      msg.interval &&
      msg.interval > announce.intervalSec &&
      msg.interval <= maxAnnounceSecs
    ) {
      clearInterval(announce.intervalId);
      announce.intervalSec = msg.interval;
      // @ts-ignore
      announce.intervalId = setInterval(
        () => this.broadcastAnnouncement(msg.info_hash),
        announce.intervalSec * 1000
      );
    }

    if (msg.offer && msg.offer_id) {
      if (
        this.connectedPeers.has(msg.peer_id) ||
        this.externalHandledOffers.has(msg.offer_id)
      ) {
        return;
      }

      const peer = initPeer(false, false, this.rtcConfig);

      peer.once(events.signal, async (answer) =>
        socket.send(
          JSON.stringify({
            // @ts-ignore
            answer: { ...answer, sdp: await encrypt(announce.key, answer.sdp) },
            action: TRACKER_ACTION,
            info_hash: msg.info_hash,
            peer_id: selfId,
            to_peer_id: msg.peer_id,
            offer_id: msg.offer_id,
          })
        )
      );
      peer.on(events.connect, () =>
        this.handlePeerConnection(peer, msg.info_hash, msg.peer_id)
      );
      peer.on(events.close, () => this.handlePeerDisconnection(msg.peer_id));
      peer.signal({
        ...msg.offer,
        // @ts-ignore
        sdp: await decrypt(announce.key, msg.offer.sdp),
      });

      return;
    }

    if (msg.answer) {
      const offer = announce.offers[msg.offer_id];
      if (this.connectedPeers.has(msg.peer_id) || offer?.acquired) {
        return;
      }

      if (offer) {
        const { peer } = offer;

        if (peer.destroyed) {
          return;
        }

        offer.acquired = true;
        peer.on(events.connect, () =>
          this.handlePeerConnection(peer, msg.info_hash, msg.peer_id)
        );
        peer.on(events.close, () => this.handlePeerDisconnection(msg.peer_id));
        peer.signal({
          ...msg.answer,
          // @ts-ignore
          sdp: await decrypt(announce.key, msg.answer.sdp),
        });
      }
    }
  }

  private async handlePeerDisconnection(peerId: string) {
    this.connectedPeers.get(peerId)?.destroy();
    this.connectedPeers.delete(peerId);

    this.emit("peer disconnected", peerId);
  }

  private handlePeerConnection(
    peer: Peer.Instance,
    infoHash: string,
    peerId: string,
    offerId?: string
  ) {
    this.connectedPeers.set(peerId, peer);

    const announce = this.announcements.get(infoHash);

    if (offerId && announce && announce.offers[offerId]) {
      delete announce.offers[offerId];
    }

    this.emit("peer connected", { peer, infoHash, peerId });
    this.emit(`peer connected ${infoHash}`, { peer, infoHash, peerId });
  }

  async reconnectToTracker(url: string) {
    this.sockets.get(url)?.close();
    this.sockets.delete(url);

    const socket = new WebSocket(url);
    socket.onmessage = (e) => this.handleTrackerMessage(url, e);

    return new Promise((done) => {
      this.sockets.set(url, socket);
      done(url);
    });
  }

  async connectToTrackers() {
    return await Promise.all(
      this.trackerUrls.map((url) => this.reconnectToTracker(url))
    );
  }

  stopAnnouncing(infoHash: string) {
    if (!this.announcements.has(infoHash)) return;
    const announce = this.announcements.get(infoHash)!;

    clearInterval(announce.intervalId);

    Object.values(announce.offers).forEach((offer) => {
      offer.peer.destroy();
    });
  }

  private createOffers = () =>
    fromEntries(
      new Array(offerPoolSize).fill("").map(() => {
        const peer = initPeer(true, false, this.rtcConfig);

        return [
          genId(INFO_HASH_SIZE),
          {
            peer,
            acquired: false,
            signalP: new Promise<Peer.SignalData>((done) =>
              peer.once(events.signal, done)
            ),
          },
        ];
      })
    );

  async createAnnounce(seed: string): Promise<string> {
    const infoHash = await this.generateInfoHash(seed);

    this.announcements.set(infoHash, {
      key: genKey(seed),
      intervalSec: defaultAnnounceSecs,
      offers: this.createOffers(),
      // @ts-ignore
      intervalId: setInterval(
        () => this.broadcastAnnouncement(infoHash),
        defaultAnnounceSecs * 1000
      ),
    });

    this.broadcastAnnouncement(infoHash);

    return infoHash;
  }

  private async broadcastAnnouncement(infoHash: string) {
    const announce = this.announcements.get(infoHash);
    if (!announce) return;

    let sockets = Array.from(this.sockets.values());
    await Promise.all(
      sockets.map(async (socket) => {
        socket.send(
          JSON.stringify({
            action: TRACKER_ACTION,
            info_hash: infoHash,
            numwant: offerPoolSize,
            peer_id: selfId,
            offers: await Promise.all(
              entries(announce.offers)
                .filter(([, { acquired }]) => !acquired)
                .map(async ([id, { signalP }]) => {
                  const offer = await signalP;

                  return {
                    offer_id: id,
                    offer: {
                      ...offer,
                      // @ts-ignore
                      sdp: await encrypt(announce.key, offer.sdp),
                    },
                  };
                })
            ),
          })
        );
      })
    );
  }

  private async generateInfoHash(seed: string): Promise<string> {
    return crypto.subtle
      .digest(
        "SHA-1",
        encodeBytes(`${seed}:${libName}:${this.version}:${seed}`)
      )
      .then((buffer): string =>
        Array.from(new Uint8Array(buffer))
          .map((b) => b.toString(36))
          .join("")
          .slice(0, INFO_HASH_SIZE)
      );
  }
}
