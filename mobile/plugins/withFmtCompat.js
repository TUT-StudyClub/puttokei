/**
 * Xcode 26 + React Native 0.76 環境で発生する fmt / RCT-Folly の
 * `consteval` 由来コンパイルエラーを回避する Expo config plugin。
 *
 * Podfile の post_install に対象 Pod の C++ 標準を c++17 に固定する
 * ブロックを挿入する。プレビルド毎に走っても冪等になるよう marker で判定する。
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# fmt-compat: Xcode 26 + RN 0.76 workaround';

const INJECTED_BLOCK = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      if ['fmt', 'RCT-Folly'].include?(target.name)
        target.build_configurations.each do |config|
          config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        end
      end
    end
`;

const withFmtCompat = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const podfilePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        'Podfile',
      );
      const original = fs.readFileSync(podfilePath, 'utf8');

      if (original.includes(MARKER)) {
        return modConfig;
      }

      const patched = original.replace(
        /(\n\s+react_native_post_install\([\s\S]*?\)\s*\n)/,
        `$1${INJECTED_BLOCK}`,
      );

      if (patched === original) {
        throw new Error(
          'withFmtCompat: react_native_post_install ブロックを Podfile で検出できませんでした',
        );
      }

      fs.writeFileSync(podfilePath, patched);
      return modConfig;
    },
  ]);
};

module.exports = withFmtCompat;
