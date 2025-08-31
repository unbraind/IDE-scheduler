/**
 * Configuration for running KiloService integration tests with the Kilo Code extension enabled.
 * See: https://code.visualstudio.com/api/working-with-extensions/testing-extension
 */

import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  label: 'kiloServiceTest',
  files: 'out/suite/kiloService.test.js',
  workspaceFolder: '.',
  mocha: {
    ui: 'tdd',
    timeout: 60000,
  },
  launchArgs: [
    '--enable-proposed-api=kilocode.kilo-code',
    // Don't disable all extensions, as we need the Kilo Code extension to be available
    '--disable-extension=ms-vscode.vscode-typescript-next'
  ]
});
