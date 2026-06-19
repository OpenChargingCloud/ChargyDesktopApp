import { describe, expect, test } from 'vitest';
import {
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
