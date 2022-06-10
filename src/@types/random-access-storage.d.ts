declare module "random-access-storage" {
  import * as Buffer from "node:buffer";
  import EventEmitter from "node:events";

  enum OpType {
    // NON_BLOCKING_OPS
    READ_OP = 0,
    WRITE_OP = 1,
    DEL_OP = 2,
    STAT_OP = 3,
    // BLOCKING_OPS
    OPEN_OP = 4,
    CLOSE_OP = 5,
    DESTROY_OP = 6,
  }

  interface AbstractStorageRequest<T extends RandomAccessStorage> {
    type: OpType;
    offset: number;
    data: null | Buffer;
    size: number;
    storage: T;

    callback: PublicCallback<AbstractStorageStat | Buffer | undefined>;
  }

  type ReadRequest<T extends AbstractRandomAccess> = AbstractRandomAccess<T> & {
    type: OpType.READ_OP;
    data: null;
    callback: PublicCallback<Buffer>;
  };
  type WriteRequest<T extends AbstractRandomAccess> =
    AbstractRandomAccess<T> & {
      type: OpType.WRITE_OP;
      data: Buffer;
      callback: PublicCallback;
    };

  type OpenRequest<T extends AbstractRandomAccess> = AbstractRandomAccess<T> & {
    type: OpType.OPEN_OP;
    data: null;
    callback: PublicCallback;
  };
  type CloseRequest<T extends AbstractRandomAccess> =
    AbstractRandomAccess<T> & {
      type: OpType.CLOSE_OP;
      data: null;
      callback: PublicCallback;
    };
  type DeleteRequest<T extends AbstractRandomAccess> =
    AbstractRandomAccess<T> & {
      type: OpType.DEL_OP;
      data: null;
      callback: PublicCallback;
    };
  type DestroyRequest<T extends AbstractRandomAccess> =
    AbstractRandomAccess<T> & {
      type: OpType.DESTROY_OP;
      data: null;
      callback: PublicCallback;
    };
  type StatRequest<T extends AbstractRandomAccess> = AbstractRandomAccess<T> & {
    type: OpType.STAT_OP;
    data: null;
    callback: PublicCallback<AbstractStorageStat>;
  };

  export interface AbstractStorageStat {
    size: number;
  }

  type PublicCallback<T = undefined> = (
    err: null | Error,
    result: T | null,
  ) => void;

  export interface AbstractRandomAccess extends EventEmitter {
    readonly readable: boolean;
    readonly writable: boolean;
    readonly deletable: boolean;
    readonly statable: boolean;
    preferReadonly: boolean;

    readonly opened: boolean;
    readonly closed: boolean;
    readonly destroyed: boolean;

    on(event: "open", cb: () => void): this;
    on(event: "close", cb: () => void): this;
    on(event: "destroy", cb: () => void): this;

    open(cb: PublicCallback);
    close(cb: PublicCallback);
    read(offset: number, size: number, cb: PublicCallback<Buffer>);
    write(offset: number, data: Buffer, cb?: PublicCallback);
    del(offset: number, size: number, cb?: PublicCallback);
    stat(cb: PublicCallback<AbstractStorageStat>): void;
  }

  export default class RandomAccessStorage implements AbstractRandomAccess {
    constructor(
      ops: Partial<{
        openReadonly: (req: OpenRequest<this>) => void;
        open: (req: OpenRequest<this>) => void;
        read: (req: ReadRequest<this>) => void;
        write: (req: WriteRequest<this>) => void;
        del: (req: DelRequest<this>) => void;
        stat: (req: StatRequest<this>) => void;
        close: (req: CloseRequest<this>) => void;
        destroy: (req: DestroyRequest<this>) => void;
      }>,
    );
  }
}
