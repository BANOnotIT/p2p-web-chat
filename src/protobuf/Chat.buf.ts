import { Type, Field, Message } from "protobufjs/light";

@Type.d("Chat")
export class ChatBuf extends Message<ChatBuf> {
  @Field.d(1, "bytes")
  public sharedSecret!: Uint8Array;
}
