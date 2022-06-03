import { Type, Field, Message } from "protobufjs/light";

@Type.d("UserMessage")
export class UserMessageBuf extends Message<UserMessageBuf> {
  @Field.d(1, "string")
  public text!: string;

  @Field.d(2, "uint64")
  public senderTimestamp!: number;

  @Field.d(3, "string")
  public nonce!: string;

  @Field.d(4, "string")
  public sender!: string;

  @Field.d(5, "string", "optional")
  public afterMsgId?: string;

  @Field.d(6, "string")
  public padding!: string;

  get timestamp(): Date {
    return new Date(this.senderTimestamp);
  }
}
