import type { Db } from '@krug/db';
import type { Config } from './config';

export interface AppEnv {
  Variables: {
    db: Db;
    config: Config;
    requestId: string;
    userId: string | undefined;
  };
}
