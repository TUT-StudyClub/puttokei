module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    plugins: [
      [
        '@tamagui/babel-plugin',
        {
          components: ['tamagui'],
          config: './tamagui.config.ts',
          logTimings: true,
          disableExtraction: process.env.NODE_ENV === 'development',
        },
      ],
      // react-native-reanimated/plugin は babel-preset-expo が
      // パッケージの存在を検知して自動で末尾に追加するので、ここでは追加しない
      // （二重適用すると "Failed to create a worklet" エラーになる）。
    ],
  };
};
