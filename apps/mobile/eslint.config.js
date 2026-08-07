// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      // All instances in this codebase are legitimate: loading-state resets, hydration
      // flags, derived-state initialisation from async data, and refetch-on-mount.
      // The rule fires for any synchronous setState call inside an effect body, which
      // is an overly broad heuristic for React Native projects where these patterns are
      // idiomatic and do not cause observable cascading-render problems.
      "react-hooks/set-state-in-effect": "off",

      // React Native renders &apos; literally — it is not HTML. Contractions in
      // user-facing text are not XSS vectors on native; the rule exists for the web DOM.
      "react/no-unescaped-entities": "off",

      // Animated.Value must be passed into Animated.View's style prop, which is
      // evaluated during render. The canonical React Native Animated pattern requires
      // this; there is no alternative that avoids touching .current in JSX.
      "react-hooks/refs": "off",
    },
  },
]);
