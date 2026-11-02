/** Application input/transport rules; POI identity matching remains the library's responsibility. */
export function stationEVSEId(value: string): string {
    const id = value.trim();
    let controls = false;
    for (const character of id) {
        const code = character.charCodeAt(0);
        if (code < 32 || code === 127) controls = true;
    }
    if (id.length === 0 || id.length > 256 || controls || /[\s/\\?#]/u.test(id) || id === '.' || id === '..')
        throw new Error('Enter one EVSE ID (at most 256 characters, without whitespace)');
    return id;
}

export function stationProofURL(base: string, evseId: string): string {
    const url = new URL(base);
    url.search = '';
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '') + '/EVSEs/' + encodeURIComponent(stationEVSEId(evseId)) + '/proof';
    return url.href;
}

export function stationPriceStatementsURL(base:string,evseId:string):string {
    return stationProofURL(base,evseId).replace(/\/proof$/,'/priceStatements');
}
