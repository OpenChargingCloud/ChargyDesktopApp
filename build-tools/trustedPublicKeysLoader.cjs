// Node >=22.18 can import the shared TypeScript parser without a second compiler.
module.exports = function trustedPublicKeysLoader(source) {
    const callback = this.async();
    const resourcePath = this.resourcePath;
    this.addDependency(require.resolve('../src/ts/trustedPublicKeys.ts'));
    import('../src/ts/trustedPublicKeys.ts')
        .then(({ parseTrustedPublicKeysJSONL }) => {
            parseTrustedPublicKeysJSONL(source, resourcePath);
            callback(null, source);
        })
        .catch(callback);
};
