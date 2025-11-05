// Minimal config to get React running
module.exports = function override(config, env) {
  // Basic fallbacks for node modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    fs: false,
    net: false,
    tls: false,
    crypto: false,
    path: false,
    stream: false,
    buffer: false,
  };
  return config;
};
