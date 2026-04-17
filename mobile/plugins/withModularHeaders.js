const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Firebase の Swift Pod が必要とする依存にだけ modular_headers を付与する。
 * グローバル use_modular_headers! は React Native と衝突するため使わない。
 */
module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf-8');

      // グローバル設定が残っていたら除去
      contents = contents.replace(/\nuse_modular_headers!\n/, '\n');

      const modularPods = [
        'GoogleUtilities',
        'FirebaseAuthInterop',
        'FirebaseAppCheckInterop',
        'FirebaseCoreInternal',
        'RecaptchaInterop',
      ];

      const podLines = modularPods
        .map((name) => `  pod '${name}', :modular_headers => true`)
        .join('\n');

      // use_expo_modules! の直後に挿入
      if (!contents.includes(':modular_headers => true')) {
        contents = contents.replace(
          'use_expo_modules!',
          `use_expo_modules!\n\n  # Firebase Swift Pod の依存に modular headers を付与\n${podLines}`,
        );
      }

      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
};
