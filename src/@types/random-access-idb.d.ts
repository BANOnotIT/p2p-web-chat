declare module "random-access-idb" {
  import { AbstractRandomAccess } from "random-access-storage";

  class IDBStore implements AbstractRandomAccess {
    constructor(
      opts?:
        | string
        | Partial<{
            size: number;
            name: string;
            length: number;
            db: (db: IDBDatabase) => void;
          }>
    );
  }

  function storeFabric(opts: {
    size?: number;
    length?: number;
    name: string;
    db?: (db: IDBDatabase) => void;
  }): IDBStore;
  function storeFabric(
    name: string,
    opts?: Partial<{
      size: number;
      name: string;
      length: number;
      db: (db: IDBDatabase) => void;
    }>
  ): IDBStore;

  function databaseFabric(
    dbname: string,
    options?: Partial<{
      size: number;
      name: string;
      length: number;
    }>
  ): storeFabric;

  export default databaseFabric;
}
