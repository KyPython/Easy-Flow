// Empty module to replace Node.js-specific OpenTelemetry files in browser builds
// This prevents webpack from trying to bundle Node.js core modules
// This file is a drop-in replacement for the Node.js-specific file

// ES module export for browser builds
export class InstrumentationNodeModuleFile {
  constructor(name, supportedVersions, patch, unpatch) {
    this.name = name;
    this.supportedVersions = supportedVersions || [];
    // Empty implementations - these are never used in browser builds
    this.patch = patch || (() => {});
    this.unpatch = unpatch || (() => {});
  }
}

export default InstrumentationNodeModuleFile;

