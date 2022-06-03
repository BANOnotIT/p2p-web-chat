import { encodeBytes, decodeBytes } from "./utils";

const algo = "AES-CBC";

const pack = (buff: ArrayBufferLike) =>
  window.btoa(
    String.fromCharCode.apply(
      null,
      new Uint8Array(buff) as unknown as Array<number>
    )
  );

const unpack = (packed: string) => {
  const str = window.atob(packed);

  return new Uint8Array(str.length).map((_, i) => str.charCodeAt(i)).buffer;
};

export const genKey = async (secret: string) =>
  crypto.subtle.importKey(
    "raw",
    await crypto.subtle.digest({ name: "SHA-256" }, encodeBytes(secret)),
    { name: algo },
    false,
    ["encrypt", "decrypt"]
  );

export const encrypt = async (keyP: Promise<CryptoKey>, plaintext: string) => {
  const iv = crypto.getRandomValues(new Uint8Array(16));

  return JSON.stringify({
    c: pack(
      await crypto.subtle.encrypt(
        { name: algo, iv },
        await keyP,
        encodeBytes(plaintext)
      )
    ),
    iv: Array.from(iv),
  });
};

export const decrypt = async (keyP: Promise<CryptoKey>, raw: string) => {
  const { c, iv } = JSON.parse(raw);

  return decodeBytes(
    await crypto.subtle.decrypt(
      { name: algo, iv: new Uint8Array(iv) },
      await keyP,
      unpack(c)
    )
  );
};
