import { Type, Field, Message } from "protobufjs/light";

@Type.d("EncryptedEntry")
export class EncryptedEntryBuf extends Message<EncryptedEntryBuf> {
  @Field.d(1, "bytes")
  public cbcIV!: Uint8Array;
  @Field.d(2, "bytes")
  public cbcEncrypted!: Uint8Array;
}
