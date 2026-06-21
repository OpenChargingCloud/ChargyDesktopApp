import { describe, expect, test } from 'vitest';
import elliptic from 'elliptic';
import moment from 'moment';
import asn1 from 'asn1.js';
import base32Decode from 'base32-decode';
import {
    Chargy,
    isIFileInfo
} from '@open-charging-cloud/chargy-core';


describe('IFileInfo', () => {

    test('accepts browser file payloads backed by ArrayBuffer or Uint8Array', () => {

        expect(isIFileInfo({
            name: 'record.json',
            data: new ArrayBuffer(4)
        })).toBe(true);

        expect(isIFileInfo({
            name: 'clipboard',
            data: new Uint8Array([ 0x7b, 0x7d ])
        })).toBe(true);

    });

    test('rejects malformed file info objects', () => {

        expect(isIFileInfo({ data: new ArrayBuffer(4) })).toBe(false);
        expect(isIFileInfo({ name: 'record.json', data: 'not binary' })).toBe(false);
        expect(isIFileInfo(null)).toBe(false);

    });

});



describe('Chargy multilanguage handling', () => {

    test('completes generated multilanguage texts for all configured UI languages', () => {

        const chargy = new Chargy(
            {
                Greeting: {
                    de: "Hallo",
                    en: "Hello"
                },
                OnlyGerman: {
                    de: "Nur deutsch"
                },
                WithParameter: {
                    de: "Wert %p",
                    en: "Value %p"
                }
            },
            [ "de", "en" ],
            elliptic,
            moment,
            asn1,
            base32Decode,
            () => ""
        );

        expect(chargy.GetLocalizedMessage("Greeting")).toBe("Hallo");
        expect(chargy.GetMultilanguageText("Missing")).toMatchObject({
            de: "Missing",
            en: "Missing"
        });
        expect(chargy.GetMultilanguageText("OnlyGerman")).toMatchObject({
            de: "Nur deutsch",
            en: "Nur deutsch"
        });
        expect(chargy.GetMultilanguageTextWithParameter("WithParameter", 7)).toMatchObject({
            de: "Wert 7",
            en: "Value 7"
        });

    });

});
