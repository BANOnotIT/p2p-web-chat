import { EncryptedEntryBuf } from "../protobuf/EncryptedEntry.buf";
import { Constructor, Message } from "protobufjs/light";

const enc = new TextEncoder();
let salt = enc.encode(`hljnk.afspd;ukj.fah;sdufka+poakn;sdf;ha`);

export class AESCBCCryptor {
  constructor(private key: CryptoKey | Promise<CryptoKey>) {}

  private static algo = "AES-CBC";

  static fromU8Array(array: Uint8Array) {
    const keyMaterialP = crypto.subtle.importKey("raw", array, "PBKDF2", false, [
      "deriveBits",
      "deriveKey",
    ]);

    const rootKey = keyMaterialP.then((keyMaterial) =>
      crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          iterations: 100_000,
          hash: "SHA-256",
          salt,
        },
        keyMaterial,
        { name: "AES-CBC", length: 256 },
        true,
        ["encrypt", "decrypt"],
      ),
    );

    return new AESCBCCryptor(rootKey);
  }

  async encrypt(inp: Uint8Array): Promise<Uint8Array> {
    const entry = await this.encryptToEntry(inp);
    return EncryptedEntryBuf.encode(entry).finish();
  }

  async encryptToEntry(inp: Uint8Array): Promise<EncryptedEntryBuf> {
    const iv = crypto.getRandomValues(new Uint8Array(16));

    const entry = new EncryptedEntryBuf();
    entry.cbcIV = iv;
    entry.cbcEncrypted = new Uint8Array(
      (await crypto.subtle.encrypt(
        { name: AESCBCCryptor.algo, iv },
        await this.key,
        inp,
      )) as ArrayBuffer,
    );

    return entry;
  }

  async decrypt<T extends Message>(inp: Uint8Array, decoder: Constructor<T>) {
    const entry = EncryptedEntryBuf.decode(inp);

    return this.decryptFromEntry(entry, decoder);
  }

  async decryptFromEntry<T extends Message>(
    entry: EncryptedEntryBuf,
    decoder: Constructor<T>,
  ) {
    const plain = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: AESCBCCryptor.algo, iv: entry.cbcIV },
        await this.key,
        entry.cbcEncrypted,
      ),
    );

    return Message.decode.call(decoder, plain) as unknown as T;
  }
}
