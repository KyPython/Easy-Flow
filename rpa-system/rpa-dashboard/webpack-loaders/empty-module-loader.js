// Webpack loader that replaces OpenTelemetry Node.js-specific file with empty module
// This prevents webpack from trying to parse the file and resolve 'path' module

module.exports = function(source) {
  // Return the content of our empty module replacement
  return `
// Empty module replacement for Node.js-specific OpenTelemetry file
export class InstrumentationNodeModuleFile {
  constructor(name, supportedVersions, patch, unpatch) {
    this.name = name;
    this.supportedVersions = supportedVersions || [];
    this.patch = patch || (() => {});
    this.unpatch = unpatch || (() => {});
  }
}

export default InstrumentationNodeModuleFile;
  `;
};

