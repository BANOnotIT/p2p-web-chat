declare module "random-access-idb" {
  import { AbstractRandomAccess } from "random-access-storage";

  export interface IDBStore extends AbstractRandomAccess {
    constructor(
      opts?:
        | string
        | Partial<{
            size: number;
            name: string;
            length: number;
            db: (db: IDBDatabase) => void;
          }>,
    );
  }

  function databaseFabric(
    dbname: string,
    options?: Partial<{
      size: number;
      name: string;
      length: number;
    }>,
  ): (
    filename?: string,
    options?: {
      size?: number;
      length?: number;
      name: string;
      db?: (db: IDBDatabase) => void;
    },
  ) => IDBStore;

  export default databaseFabric;
}
