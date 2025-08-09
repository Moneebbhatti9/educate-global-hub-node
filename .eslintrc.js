module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: [
    "airbnb-base",
    "plugin:prettier/recommended", // Integrates Prettier with ESLint
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    // Formatting
    quotes: ["error", "single"], // Single quotes
    semi: ["error", "always"], // Always semicolons
    "linebreak-style": ["error", "unix"], // LF endings
    "comma-dangle": ["error", "always-multiline"], // Trailing commas
    "object-curly-spacing": ["error", "always"],
    "array-bracket-spacing": ["error", "never"],
    "arrow-parens": ["error", "always"],
    "max-len": ["error", { code: 120, ignoreUrls: true }], // Allow long URLs in code
    indent: ["error", 2],

    // Code style preferences
    "no-console": "off", // Allow console.log for backend
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "no-underscore-dangle": "off",
    camelcase: "off",
    radix: ["error", "always"], // Require radix param in parseInt
    "no-param-reassign": "off",
    "consistent-return": "off",
    "no-return-await": "off",
    "prefer-destructuring": "off",
    "no-restricted-syntax": "off",
    "guard-for-in": "off",
    "no-continue": "off",
    "no-plusplus": "off",
    "no-bitwise": "off",
    "no-mixed-operators": "off",
    "no-nested-ternary": "off",

    // Import rules
    "import/extensions": "off",
    "import/prefer-default-export": "off",
    "import/no-extraneous-dependencies": "off",
  },
  overrides: [
    {
      files: ["**/*.test.js", "**/*.spec.js"],
      env: {
        jest: true,
      },
      rules: {
        "no-unused-expressions": "off",
      },
    },
  ],
};
