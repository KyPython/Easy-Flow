// Minimal config tweaks for React + optional dev-speed optimizations
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

  // Fast Refresh disabled due to incomplete removal causing $RefreshSig$ errors
  // Re-enable Fast Refresh for proper HMR functionality
  //
  // NOTE: The original code attempted to remove React Refresh to improve dev startup,
  // but incomplete removal causes runtime errors. Leaving Fast Refresh enabled is safer.
  //
  // if (process.env.NODE_ENV === 'development') {
  //   try {
  //     // Remove the ReactRefresh webpack plugin if present
  //     if (Array.isArray(config.plugins)) {
  //       config.plugins = config.plugins.filter(p => {
  //         const name = p && p.constructor && p.constructor.name;
  //         return name !== 'ReactRefreshWebpackPlugin' && name !== 'ReactRefreshPlugin';
  //       });
  //     }
  //
  //     // Strip react-refresh related entries from the dev entry points
  //     const stripRefreshEntry = (entry) => {
  //       if (Array.isArray(entry)) return entry.filter(e => typeof e !== 'string' || !/react-refresh|ReactRefresh|@pmmmwh\/react-refresh-webpack-plugin/.test(e));
  //       return entry;
  //     };
  //
  //     if (config.entry) {
  //       if (typeof config.entry === 'object' && !Array.isArray(config.entry)) {
  //         Object.keys(config.entry).forEach(k => { config.entry[k] = stripRefreshEntry(config.entry[k]); });
  //       } else {
  //         config.entry = stripRefreshEntry(config.entry);
  //       }
  //     }
  //
  //     // Remove react-refresh/babel from babel-loader plugin lists where present
  //     if (config.module && Array.isArray(config.module.rules)) {
  //       config.module.rules.forEach(rule => {
  //         const uses = Array.isArray(rule.use) ? rule.use : (rule.use ? [rule.use] : []);
  //         uses.forEach(u => {
  //           if (u && u.loader && u.loader.includes('babel-loader') && u.options && Array.isArray(u.options.plugins)) {
  //             u.options.plugins = u.options.plugins.filter(pl => {
  //               // Handle plugin arrays or strings
  //               const key = Array.isArray(pl) ? pl[0] : pl;
  //               if (!key) return true;
  //               return !(typeof key === 'string' && key.includes('react-refresh'));
  //             });
  //           }
  //         });
  //       });
  //     }
  //   } catch (e) {
  //     // Don't fail the build if we couldn't strip refresh; it's an optimization only
  //     // eslint-disable-next-line no-console
  //     console.warn('config-overrides: failed to strip react-refresh:', e && e.message);
  //   }
  // }

  return config;
};
