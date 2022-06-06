import { Type, Field, Message } from "protobufjs/light";

@Type.d("Chat")
export class ChatBuf extends Message<ChatBuf> {
  @Field.d(1, "bytes")
  sharedSecret!: Uint8Array;
  @Field.d(2, "string")
  readonly magic = "chatMagic";
  @Field.d(3, "string")
  uuid!: string;
}
