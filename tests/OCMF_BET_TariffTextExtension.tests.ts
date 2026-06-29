import { createPublicKey, verify as verifySignature } from 'node:crypto';
import { readFileSync } from 'node:fs';
import Decimal from 'decimal.js';
import { describe, expect, test } from 'vitest';
import {
    IsAChargeTransparencyRecord,
    type IChargingTariff,
    type IOCMFChargeTransparencyRecord
} from '@open-charging-cloud/chargy-core';
import { verifyChargeData } from './testHelper';


const fixtureRoot = new URL('fixtures/OCMF/BET_TariffTextExtension/', import.meta.url);
const publicKey = createPublicKey(readFileSync(new URL('publicKey.pem', fixtureRoot), 'utf8'));

const fixtureNames = [
    '001/001-01',
    '001/001-02',
    '001/001-03',
    '002/002-01',
    '002/002-02',
    '002/002-03',
    '003/003-01',
    '003/003-02',
    '003/003-03'
] as const;


function readFixture(fileName: string): Uint8Array {
    return new Uint8Array(readFileSync(new URL(fileName, fixtureRoot)));
}


function readTextFixture(fileName: string): string {
    return readFileSync(new URL(fileName, fixtureRoot), 'utf8').trim();
}


function verifyOCMFSignature(document: string): void {

    const parts = document.split('|');
    const payload = parts[1];
    const signatureDocumentText = parts[2];

    if (parts[0] !== 'OCMF' || payload === undefined || signatureDocumentText === undefined)
        throw new Error('Invalid OCMF fixture envelope');

    const signatureDocument: unknown = JSON.parse(signatureDocumentText);

    if (typeof signatureDocument !== 'object' ||
        signatureDocument === null            ||
        !('SD' in signatureDocument)           ||
        typeof signatureDocument.SD !== 'string')
    {
        throw new Error('OCMF fixture has no hexadecimal signature');
    }

    expect(verifySignature(
        'sha256',
        Buffer.from(payload, 'utf8'),
        publicKey,
        Buffer.from(signatureDocument.SD, 'hex')
    )).toBe(true);

}


function numericValue(value: unknown): number {

    if (typeof value === 'number')
        return value;

    if (value instanceof Decimal)
        return value.toNumber();

    if (typeof value === 'string' && /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value))
        return Number(value);

    throw new Error('Expected a numeric CTR value: ' +
                     JSON.stringify(value));

}


function normalizeTariff(tariff: IChargingTariff | undefined): unknown {

    if (tariff === undefined)
        return null;

    return {
        '@id':     tariff['@id'],
        currency:  tariff.currency,
        elements:  tariff.elements?.map(element => ({
            price_components: element.price_components.map(component => ({
                type:      component.type,
                price:     numericValue(component.price),
                step_size: component.step_size
            })),
            ...(element.restrictions !== undefined
                    ? { restrictions: element.restrictions }
                    : {})
        }))
    };

}


function normalizeRecord(record: IOCMFChargeTransparencyRecord): unknown {

    const session     = record.chargingSessions?.[0];
    const measurement = session?.measurements[0];

    if (session === undefined || measurement === undefined)
        throw new Error('BET OCMF fixture did not produce a complete charging session');

    return {
        ocmf: {
            formatVersion:             record.ocmf?.formatVersion,
            tariffText:                record.ocmf?.tariffText,
            tariffTextInterpretation:  record.ocmf?.tariffTextInterpretation
        },
        chargingTariff: normalizeTariff(record.chargingTariffs?.[0]),
        session: {
            chargingStationId:       session.chargingStationId ?? null,
            EVSEId:                  session.EVSEId            ?? null,
            ConnectorId:             session.ConnectorId       ?? null,
            chargingStationFirmware: session.chargingStation?.firmware?.version ?? null,
            cable:                   session.Connector?.cable ?? null,
            tariffId:                session.tariffId,
            chargingTariff:          normalizeTariff(session.chargingTariffs?.[0])
        },
        measurement: {
            energyMeterId: measurement.energyMeterId,
            obis:          measurement.obis,
            unit:          measurement.unit,
            values:        measurement.values.map(value => ({
                timestamp: value.timestamp,
                value:     numericValue(value.value),
                status:    value.result?.status
            }))
        }
    };

}


async function parseFixture(fixtureName: string): Promise<IOCMFChargeTransparencyRecord> {

    const ocmfFileName = fixtureName + '.txt';
    const ocmfDocument = readTextFixture(ocmfFileName);

    verifyOCMFSignature(ocmfDocument);

    const result = await verifyChargeData(ocmfFileName, readFixture(ocmfFileName), 'text/plain');

    expect(IsAChargeTransparencyRecord(result)).toBe(true);
    if (!IsAChargeTransparencyRecord(result))
        throw new Error('BET OCMF fixture was not detected as a charge transparency record');

    return result as IOCMFChargeTransparencyRecord;

}


describe('BET OCMF tariff text file fixtures', () => {

    test.each(fixtureNames)('%s matches its expected CTR tariff mapping', async fixtureName => {

        const expectedText = readFileSync(new URL(fixtureName + '.expected.json', fixtureRoot), 'utf8');
        const expected: unknown = JSON.parse(expectedText);
        const record = await parseFixture(fixtureName);

        expect(normalizeRecord(record)).toEqual(expected);

    });

});
