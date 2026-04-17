const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/** Podfile に use_modular_headers! を挿入する config plugin。 */
module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf-8');

      if (!contents.includes('use_modular_headers!')) {
        contents = contents.replace(
          "prepare_react_native_project!\n",
          "prepare_react_native_project!\n\nuse_modular_headers!\n",
        );
        fs.writeFileSync(podfilePath, contents);
      }

      return cfg;
    },
  ]);
};
