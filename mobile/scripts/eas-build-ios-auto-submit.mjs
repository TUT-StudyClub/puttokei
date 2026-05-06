#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, '..');
const easJsonPath = path.join(projectDir, 'eas.json');

function parseArgs(argv) {
  const options = {
    buildProfile: 'preview',
    submitProfile: undefined,
    extraArgs: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--') {
      options.extraArgs = argv.slice(index + 1);
      break;
    }

    if ((arg === '--profile' || arg === '-e') && argv[index + 1]) {
      options.buildProfile = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--submit-profile' && argv[index + 1]) {
      options.submitProfile = argv[index + 1];
      index += 1;
      continue;
    }

    throw new Error(
      `Unknown argument '${arg}'. Usage: ASC_APP_ID=... npm run eas:build:ios:auto-submit -- --profile preview [--submit-profile preview] -- [extra eas build args]`,
    );
  }

  options.submitProfile = options.submitProfile ?? options.buildProfile;
  return options;
}

function readAscAppId() {
  const ascAppId = process.env.ASC_APP_ID;

  if (!ascAppId) {
    throw new Error('ASC_APP_ID is required.');
  }

  if (!/^\d+$/.test(ascAppId)) {
    throw new Error('ASC_APP_ID must contain only digits.');
  }

  return ascAppId;
}

function injectAscAppId(easJsonText, submitProfile, ascAppId) {
  const easJson = JSON.parse(easJsonText);

  easJson.submit = easJson.submit ?? {};
  easJson.submit[submitProfile] = easJson.submit[submitProfile] ?? {};
  easJson.submit[submitProfile].ios = easJson.submit[submitProfile].ios ?? {};
  easJson.submit[submitProfile].ios.ascAppId = ascAppId;

  return `${JSON.stringify(easJson, null, 2)}\n`;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectDir,
      stdio: 'inherit',
      shell: false,
    });

    const forwardSignal = (signal) => {
      child.kill(signal);
    };

    const cleanup = () => {
      process.removeListener('SIGINT', forwardSignal);
      process.removeListener('SIGTERM', forwardSignal);
    };

    process.once('SIGINT', forwardSignal);
    process.once('SIGTERM', forwardSignal);

    // npx 自体が見つからない等で `error` が発火した場合、`close` は呼ばれず
    // Promise が解決されないままハングする。reject して呼び出し元へ伝搬させる。
    child.on('error', (err) => {
      cleanup();
      reject(err);
    });

    child.on('close', (code, signal) => {
      cleanup();
      resolve({ code, signal });
    });
  });
}

const { buildProfile, submitProfile, extraArgs } = parseArgs(process.argv.slice(2));
const ascAppId = readAscAppId();
const originalEasJson = fs.readFileSync(easJsonPath, 'utf8');

let result = null;
let runError = null;
try {
  fs.writeFileSync(easJsonPath, injectAscAppId(originalEasJson, submitProfile, ascAppId));

  // npx eas は npm registry の別パッケージ `eas` を取得してしまうため、
  // `--package=eas-cli` で明示的に eas-cli の bin (= `eas`) を呼ぶ。
  result = await run('npx', [
    '--package=eas-cli',
    '--yes',
    '--',
    'eas',
    'build',
    '--platform',
    'ios',
    '--profile',
    buildProfile,
    '--auto-submit-with-profile',
    submitProfile,
    ...extraArgs,
  ]);
} catch (err) {
  runError = err;
} finally {
  // eas.json の復元はシグナル再送 / エラー伝搬よりも前に必ず実施する。
  fs.writeFileSync(easJsonPath, originalEasJson);
}

if (runError) {
  throw runError;
}

if (result.signal) {
  process.kill(process.pid, result.signal);
}

process.exitCode = result.code ?? 1;
