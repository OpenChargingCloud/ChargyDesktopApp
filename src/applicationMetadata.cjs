const packageJson = require('../package.json');

const applicationEdition = "Community Edition";
const copyright = "&copy; 2018-2026 GraphDefined GmbH";
const applicationVersion = packageJson.version;

module.exports = {
    applicationEdition,
    applicationVersion,
    copyright,
    packageJson
};
