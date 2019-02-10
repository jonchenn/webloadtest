const {generateLoads} = require('./src/core');
const argv = require('minimist')(process.argv.slice(2));

function printUsage() {
  let usage = `
Usage: yarn start --config=[PATH_TO_FILE]

Required:
  --config=PATH_TO_FILE\Path to the config JS file.
  --output=OUTPUT_PATH\tPath to the output file.

Options:
  --verbose\tDisplay AMP validation errors.

Examples:
  # Amplify a page and generate results in /output folder.
  yarn start --config=./sample/sample-config.js
  `;
  console.log(usage);
}

let config = argv['config'] ?
    require(`./${argv['config']}`) : null;

if (!config || !argv['output']) {
  printUsage();
  return;
}

generateLoads(config, argv);
