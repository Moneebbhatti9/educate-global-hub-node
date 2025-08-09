module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: ["airbnb-base"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    "no-console": "off", // Allow console.log for server logging
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "no-underscore-dangle": "off",
    camelcase: "off",
    "max-len": ["error", { code: 120 }],
    indent: ["error", 2],
    "linebreak-style": ["error", "unix"],
    quotes: ["error", "single"],
    semi: ["error", "always"],
    "comma-dangle": ["error", "always-multiline"],
    "object-curly-spacing": ["error", "always"],
    "array-bracket-spacing": ["error", "never"],
    "arrow-parens": ["error", "always"],
    "no-param-reassign": "off", // Allow parameter reassignment for Express
    "consistent-return": "off", // Allow different return types
    "no-return-await": "off", // Allow return await
    "prefer-destructuring": "off", // Allow both destructuring and dot notation
    "no-restricted-syntax": "off", // Allow for...of loops
    "guard-for-in": "off", // Allow for...in loops
    "no-continue": "off", // Allow continue statements
    "no-plusplus": "off", // Allow increment/decrement operators
    "no-bitwise": "off", // Allow bitwise operators
    "no-mixed-operators": "off", // Allow mixed operators
    "no-nested-ternary": "off", // Allow nested ternary operators
    "import/extensions": "off", // Allow imports without extensions
    "import/prefer-default-export": "off", // Allow named exports
    "import/no-extraneous-dependencies": "off", // Allow dev dependencies in tests
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
