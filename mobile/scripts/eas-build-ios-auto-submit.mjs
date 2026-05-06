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
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: projectDir,
      stdio: 'inherit',
      shell: false,
    });

    const forwardSignal = (signal) => {
      child.kill(signal);
    };

    process.once('SIGINT', forwardSignal);
    process.once('SIGTERM', forwardSignal);

    child.on('close', (code, signal) => {
      process.removeListener('SIGINT', forwardSignal);
      process.removeListener('SIGTERM', forwardSignal);
      resolve({ code, signal });
    });
  });
}

const { buildProfile, submitProfile, extraArgs } = parseArgs(process.argv.slice(2));
const ascAppId = readAscAppId();
const originalEasJson = fs.readFileSync(easJsonPath, 'utf8');

try {
  fs.writeFileSync(easJsonPath, injectAscAppId(originalEasJson, submitProfile, ascAppId));

  const result = await run('npx', [
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

  if (result.signal) {
    process.kill(process.pid, result.signal);
  }

  process.exitCode = result.code ?? 1;
} finally {
  fs.writeFileSync(easJsonPath, originalEasJson);
}
