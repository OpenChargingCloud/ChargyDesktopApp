const packageJson         = require('../package.json');

const applicationEdition  = "Community Edition";
const applicationVersion  = packageJson.version;
const copyright           = "&copy; 2018-2026 GraphDefined GmbH";

module.exports = {
    applicationEdition,
    applicationVersion,
    copyright,
    packageJson
};
