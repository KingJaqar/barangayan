const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const config = require(path.join(root, 'apps/resident-android-mobile/metro.config.js'));
config.watchFolders = [path.join(root, 'packages/shared'), path.join(root, 'node_modules')];
module.exports = config;
