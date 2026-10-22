/**
 * Localhost web test target only (plan OD-14). Native-only modules that have no browser implementation resolve here when
 * the app is bundled for web (see metro.config.js). Calls fail with a clear message instead of a native-module crash, and
 * component-style exports render a visible notice. Nothing in this file is bundled for iOS.
 */
const React = require('react');
const { Text } = require('react-native');

const MESSAGE = 'This capability needs a physical iOS device and is not available in the browser test target.';

function unavailable(name) {
  if (/^[A-Z]/.test(name)) {
    const Notice = () => React.createElement(Text, { accessibilityRole: 'alert' }, MESSAGE);
    Notice.displayName = name;
    return Notice;
  }
  return () => { throw new Error(MESSAGE); };
}

module.exports = new Proxy({ __esModule: true, default: undefined }, {
  get(target, key) {
    if (typeof key !== 'string' || key in target) return target[key];
    return unavailable(key);
  },
});
