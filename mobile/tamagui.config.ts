/**
 * Tamagui のテーマ設定。
 * 公式の `@tamagui/config/v3` をベースに、後続 Epic でブランドカラーを足す想定。
 */

import { config as tamaguiBaseConfig } from '@tamagui/config/v3';
import { createTamagui } from 'tamagui';

const config = createTamagui(tamaguiBaseConfig);

type AppConfig = typeof config;

declare module 'tamagui' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config;
