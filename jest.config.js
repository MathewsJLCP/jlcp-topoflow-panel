// force timezone to UTC to allow tests to work regardless of local timezone
// generally used by snapshots, but can affect specific tests
process.env.TZ = 'UTC';

const base = require('./.config/jest.config');

module.exports = {
  // Jest configuration provided by Grafana scaffolding
  ...base,
  transform: {
    ...base.transform,
    // Imagens importadas viram o nome do arquivo — ver `jest-file-transform.js`.
    '^.+\\.(png|jpe?g|gif|webp)$': require.resolve('./jest-file-transform.js'),
  },
};
