import {renderPOIConsistency} from './poiConsistencyView';
import { canonicalJSON, etagToText, isObject, parseJSON, prettyJSON } from '@open-charging-cloud/wwcp-poi';
import type { JSONValue } from '@open-charging-cloud/wwcp-poi';
import type { LoadedStationProof } from './stationProofData';
import { renderSecurityFingerprint } from './securityFingerprintView';

function localized(value: JSONValue | undefined, language: string): string | undefined {
    if (typeof value === 'string')
        return value;
    if (isObject(value)) {
        for (const key of [language, language.split('-')[0] ?? language, 'en'])
            if (typeof value[key] === 'string')
                return value[key];
    }
    return undefined;
}

/** A verified, time-qualified snapshot. Raw meter keys and tariff definitions are not a measurement/price verdict. */
export function renderStationProof(proof: LoadedStationProof, options: {
    readonly localize: (key: string) => string;
    readonly language: string;
    readonly saved: boolean;
    readonly cached: boolean;
}): HTMLElement {
    const { localize, language } = options;
    const { station, context, evseId } = proof;
    const root = document.createElement('section');
    root.className = 'poiStationResult';
    root.dataset['evseId'] = evseId;
    const text = (parent: HTMLElement, value: string, tag: 'p' | 'h3' | 'h4' = 'p'): HTMLElement => {
        const element = parent.appendChild(document.createElement(tag));
        element.textContent = value;
        return element;
    };
    const fields = (parent: HTMLElement): ((label: string, value: string | undefined) => void) => {
        const list = parent.appendChild(document.createElement('dl'));
        return (label, value): void => {
            if (value === undefined || value === '')
                return;
            const term = list.appendChild(document.createElement('dt'));
            term.textContent = localize(label);
            const detail = list.appendChild(document.createElement('dd'));
            detail.textContent = value;
        };
    };
    const details = (parent: HTMLElement, title: string): HTMLDetailsElement => {
        const element = parent.appendChild(document.createElement('details'));
        const summary = element.appendChild(document.createElement('summary'));
        summary.textContent = title;
        return element;
    };
    const original = (parent: HTMLElement, value: JSONValue): void => {
        const container = details(parent, localize('poiOriginalData'));
        const pre = container.appendChild(document.createElement('pre'));
        pre.className = 'poiStationRaw';
        pre.textContent = prettyJSON(value);
    };
    const capped = <T>(parent: HTMLElement, values: readonly T[], limit: number): readonly T[] => {
        if (values.length > limit)
            text(parent, `${localize('poiShowingItems')}: ${limit} / ${values.length}. ${localize('poiRemainingInOriginal')}`);
        return values.slice(0, limit);
    };
    if(proof.consistency!==undefined)root.appendChild(renderPOIConsistency(proof.consistency,localize));
    const banner = root.appendChild(document.createElement('section'));
    banner.className = 'poiStationVerdict';
    banner.dataset['state'] = station.warnings.length === 0 ? 'valid' : 'warning';
    const heading = banner.appendChild(document.createElement('h3'));
    const icon = heading.appendChild(document.createElement('i'));
    icon.className = station.warnings.length === 0 ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
    icon.setAttribute('aria-hidden', 'true');
    heading.appendChild(document.createTextNode(' ' + localize(station.warnings.length === 0 ? 'poiStationVerified' : 'poiStationVerifiedWithWarnings')));
    text(banner, localize('poiStationScope'));
    text(banner, `${localize('poiCheckedAt')}: ${new Date(context.evaluatedAt).toLocaleString(language)}`);
    if (station.warnings.length > 0) {
        const warnings = details(banner, `${localize('poiStationWarnings')} (${station.warnings.length})`);
        const list = warnings.appendChild(document.createElement('ul'));
        for (const warning of capped(warnings, station.warnings, 50)) {
            const item = list.appendChild(document.createElement('li'));
            item.textContent = warning;
        }
    }
    const name = localized(station.chargingStation['name'], language) ?? localized(station.chargingStation['@id'], language) ?? localize('poiNotProvided');
    text(root, name, 'h3');
    const basic = fields(root);
    basic('poiStationId', localized(station.chargingStation['@id'], language));
    basic('poiEVSEId', evseId);
    basic('poiCPO', localized(station.operator['name'], language) ?? localized(station.operator['@id'], language));
    basic('poiPool', localized(station.chargingPool['name'], language) ?? localized(station.chargingPool['@id'], language));
    const address = station.chargingStation['address'] ?? station.chargingPool['address'];
    if (isObject(address)) {
        const parts = ['street', 'houseNumber', 'postalCode', 'zipCode', 'city', 'town', 'country']
            .map(key => localized(address[key], language)).filter((value): value is string => value !== undefined);
        basic('poiAddress', parts.length > 0 ? parts.join(', ') : prettyJSON(address));
    }
    const location = station.chargingStation['geoLocation'] ?? station.chargingPool['geoLocation'];
    if (location !== undefined)
        basic('poiLocation', prettyJSON(location));
    basic('poiSource', proof.document.sourceURL);
    basic('poiRetrievedAt', new Date(proof.document.downloadedAt).toLocaleString(language));
    text(root, localize(proof.document.origin === 'embedded' ? 'poiEmbeddedProofNotice' : options.cached ? 'poiCachedEvidenceNotice' : 'poiFetchedEvidenceNotice'));
    const persistence = text(root, localize(options.saved ? 'poiProofSaved' : 'poiProofNotSaved'));
    persistence.className = options.saved ? 'poiStationSaved' : 'trustManagementError';

    const evses = details(root, `${localize('poiEVSEs')} (${station.evses.length})`);
    for (const evse of capped(evses, station.evses, 50)) {
        const card = evses.appendChild(document.createElement('article'));
        card.className = 'poiEntityCard';
        card.dataset['selected'] = evse['@id'] === evseId ? 'true' : 'false';
        text(card, localized(evse['name'], language) ?? localized(evse['@id'], language) ?? localize('poiNotProvided'), 'h4');
        const field = fields(card);
        field('poiEVSEId', localized(evse['@id'], language));
        if (evse['@id'] === evseId)
            text(card, localize('poiSelectedEVSE'));
        for (const [key, label] of [['maxPower', 'poiMaxPower'], ['maxVoltage', 'poiMaxVoltage'], ['maxCurrent', 'poiMaxCurrent']] as const)
            if (evse[key] !== undefined)
                field(label, canonicalJSON(evse[key]));
        const meter = evse['energyMeter'];
        field('poiMeterId', isObject(meter) ? localized(meter['@id'], language) : localized(evse['energyMeterId'], language));
        original(card, evse);
    }
    const meters = details(root, `${localize('poiMeters')} (${station.energyMeters.length})`);
    text(meters, localize('poiMeterScope'));
    if (station.energyMeters.length === 0)
        text(meters, localize('poiMetersMissing'));
    for (const meter of capped(meters, station.energyMeters, 50)) {
        const card = meters.appendChild(document.createElement('article'));
        card.className = 'poiEntityCard';
        text(card, localized(meter['serialNumber'], language) ?? localized(meter['@id'], language) ?? localize('poiNotProvided'), 'h4');
        const field = fields(card);
        for (const [key, label] of [['@id', 'poiMeterId'], ['serialNumber', 'poiMeterSerial'],
            ['manufacturerId', 'poiManufacturer'], ['modelId', 'poiModel']] as const)
            field(label, localized(meter[key], language));
        const keys = meter['publicKeys'];
        if (Array.isArray(keys))
            for (const key of capped(card, keys, 16)) {
                if (isObject(key) && typeof key['@id'] === 'string' && /^[a-f0-9]{64}$/.test(key['@id']))
                    card.appendChild(renderSecurityFingerprint(key['@id'], localize));
            }
        original(card, meter);
    }
    const tariffs = station.tariffs.get(evseId) ?? [];
    const tariffDetails = details(root, `${localize('poiStaticTariffs')} (${tariffs.length})`);
    if (tariffs.length > 0 && station.warnings.length === 0) {
        const included = text(tariffDetails, '✅ ' + localize('poiStaticTariffProven'));
        included.className = 'poiStaticTariffCheck';
    }
    text(tariffDetails, localize('poiTariffScope'));
    if (tariffs.length === 0)
        text(tariffDetails, localize('poiTariffsMissing'));
    for (const tariff of capped(tariffDetails, tariffs, 50)) {
        const card = tariffDetails.appendChild(document.createElement('article'));
        card.className = 'poiEntityCard';
        text(card, localized(tariff['name'], language) ?? localized(tariff['@id'], language) ?? localize('poiNotProvided'), 'h4');
        const field = fields(card);
        field('poiTariffId', localized(tariff['@id'], language));
        field('poiCurrency', localized(tariff['currency'], language));
        original(card, tariff);
    }
    const chain = details(root, localize('poiProofDetails'));
    const chainField = fields(chain);
    chainField('trustAnchorNetworkLabel', context.roamingNetworkId);
    chainField('trustDataOperatorLabel', context.roamingNetworkOperatorId);
    chainField('poiAttestingHolders', station.attestedBy.join(', '));
    chainField('trustAnchorQuorumLabel', `${station.attestedBy.length} / ${context.requiredConsensus}`);
    chainField('poiCommit', station.commitId);
    chainField('poiRevision', String(station.revision));
    chainField('poiTreeRoot', etagToText(station.eTag));
    chainField('poiKeyStatementDigest', context.keyStatementDigest);
    const rawProof = parseJSON(proof.document.text);
    if (isObject(rawProof)) {
        const network = rawProof['roamingNetwork'];
        const operator = isObject(network) ? network['operator'] : undefined;
        if (isObject(operator) && operator['signingKeyCertificates'] !== undefined)
            original(details(chain, localize('poiRNOCertificates')), operator['signingKeyCertificates']);
        if (rawProof['attestations'] !== undefined)
            original(details(chain, localize('poiAttestations')), rawProof['attestations']);
    }
    if (station.manufacturer !== undefined)
        original(details(root, localize('poiManufacturer')), station.manufacturer.manufacturer);
    const certificates = details(root, `${localize('poiCertificates')} (${station.certificates.length})`);
    text(certificates, localize('poiCertificateScope'));
    for (const certificate of capped(certificates, station.certificates, 20))
        original(certificates, certificate.certificate);
    const software = details(root, `${localize('poiSoftware')} (${station.transparencySoftware.length})`);
    for (const item of capped(software, station.transparencySoftware, 20)) {
        text(software, item.namedBy.entityId, 'h4');
        original(software, item.release);
    }
    const raw = details(root, localize('poiOriginalProof'));
    const pre = raw.appendChild(document.createElement('pre'));
    pre.className = 'poiStationRaw';
    pre.textContent = proof.document.text;
    return root;
}
