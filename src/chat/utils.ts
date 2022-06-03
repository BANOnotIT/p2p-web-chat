import Peer from "simple-peer-light";

const charSet =
  "0123456789AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz";

export const initPeer = (
  initiator: boolean,
  trickle: boolean,
  config?: RTCConfiguration
) => {
  // const onData = (data) => peer.__earlyDataBuffer.push(data);

  // peer.on(events.data, onData);
  // peer.__earlyDataBuffer = [];
  // peer.__drainEarlyData = (f) => {
  //   peer.off(events.data, onData);
  //   peer.__earlyDataBuffer.forEach(f);
  //   delete peer.__earlyDataBuffer;
  //   delete peer.__drainEarlyData;
  // };

  return new Peer({initiator, trickle, config});
};

export const genId = (n: number) =>
  new Array(n)
    .fill("")
    .map(() => charSet[Math.floor(Math.random() * charSet.length)])
    .join("");

// export const initGuard = (occupiedRooms, f) => (config, ns) => {
//   if (occupiedRooms[ns]) {
//     throw mkErr(`already joined room ${ns}`);
//   }
//
//   if (!config) {
//     throw mkErr("requires a config map as the first argument");
//   }
//
//   if (!config.appId && !config.firebaseApp) {
//     throw mkErr("config map is missing appId field");
//   }
//
//   if (!ns) {
//     throw mkErr("namespace argument required");
//   }
//
//   return f(config, ns);
// };

export const libName = "Trystero";

export const selfId = genId(20);

export const { keys, values, entries, fromEntries } = Object;

export const noOp = () => {};

export const mkErr = (msg: string) => new Error(`${libName}: ${msg}`);

export const encodeBytes = (txt: string) => new TextEncoder().encode(txt);

export const decodeBytes = (txt: Uint8Array) => new TextDecoder().decode(txt);

export enum events {
  "close" = "close",
  "connect" = "connect",
  "data" = "data",
  "error" = "error",
  "signal" = "signal",
  "stream" = "stream",
  "track" = "track",
}

export const combineChunks = (chunks: Uint8Array[]) => {
  const full = new Uint8Array(chunks.reduce((a, c) => a + c.byteLength, 0));

  chunks.reduce((a, c) => {
    full.set(c, a);
    return a + c.byteLength;
  }, 0);

  return full;
};
