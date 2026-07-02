import type { Configuration } from 'electron-builder'

const config: Configuration = {
  appId: 'com.webscriptum.jessica',
  productName: 'WS Jessica',
  directories: {
    buildResources: 'resources',
    output: 'release'
  },
  files: ['out/**/*'],
  publish: {
    provider: 'github',
    owner: 'webscriptum',
    repo: 'ws-jessica',
    releaseType: 'release'
  },
  mac: {
    target: [{ target: 'dmg', arch: ['x64', 'arm64'] }],
    icon: 'resources/icon.png',
    hardenedRuntime: false,
    gatekeeperAssess: false
  },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'resources/icon.ico'
  },
  nsis: {
    // oneClick è richiesto per un auto-update affidabile (install silenzioso su quit)
    oneClick: true,
    artifactName: '${name}-Setup-${version}.${ext}'
  }
}

export default config
