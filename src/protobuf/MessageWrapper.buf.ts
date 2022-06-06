import { Field, Message, Type } from "protobufjs/light";

export enum Channel {
  system = 0,
  userMessage = 1,
}

@Type.d("MessageWrapper")
export class MessageWrapperBuf extends Message<MessageWrapperBuf> {
  @Field.d(1, Channel)
  public channel!: Channel;

  @Field.d(2, "uint32")
  public idx!: number;

  @Field.d(3, "bytes")
  public message!: Uint8Array;
}
