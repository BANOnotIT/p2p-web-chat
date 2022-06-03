const charSet =
  "0123456789AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz";

export const genId = (n: number) =>
  new Array(n)
    .fill("")
    .map(() => charSet[Math.floor(Math.random() * charSet.length)])
    .join("");

export const { keys, values, entries, fromEntries } = Object;

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
