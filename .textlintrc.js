const config = require('@kubosho/configs/textlint');

module.exports = {
  ...config,
  rules: {
    ...config.rules,
    'no-dead-link': false,
  },
};
