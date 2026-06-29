import Decimal from 'decimal.js';
import { describe, expect, test } from 'vitest';
import {
    IsAChargeTransparencyRecord,
    parseOCMFBonnTariffText,
    type IMeasurement
} from '@open-charging-cloud/chargy-core';
import { calculateBETTariffTotal } from '../src/ts/betTariffCosts';
import { verifyChargeData } from './testHelper';


function measurement(startTimestamp: string,
                     startValue:     number,
                     endTimestamp:   string,
                     endValue:       number,
                     unit:           string = "kWh"): IMeasurement {

    return {
        energyMeterId: "BET-METER",
        name:          "Energy",
        obis:          "01-00:01.08.00*FF",
        unit:          unit,
        scale:         0,
        values: [
            {
                timestamp: startTimestamp,
                value:     new Decimal(startValue)
            },
            {
                timestamp: endTimestamp,
                value:     new Decimal(endValue)
            }
        ]
    };

}


describe("BET tariff cost calculation", () => {

    test("calculates costs from the real 001-03 CTR measurement", async () => {

        const fixtureURL  = new URL("fixtures/OCMF/BET_TariffTextExtension/001/001-03.txt", import.meta.url);
        const fixtureText = (await import("node:fs/promises")).readFile(fixtureURL, "utf8");
        const result      = await verifyChargeData("001-03.txt", new TextEncoder().encode(await fixtureText), "text/plain");

        expect(IsAChargeTransparencyRecord(result)).toBe(true);
        if (!IsAChargeTransparencyRecord(result))
            return;

        const measurement = result.chargingSessions?.[0]?.measurements?.[0];
        expect(measurement).toBeDefined();
        if (measurement === undefined)
            return;

        const costs = calculateBETTariffTotal(
            parseOCMFBonnTariffText("001;EUR;250;79;15;1"),
            measurement
        );

        expect(costs?.totalPrice.toFixed(5)).toBe("11.32307");

    });

    test("calculates profile 001 with energy and delayed blocking costs", () => {

        const costs = calculateBETTariffTotal(
            parseOCMFBonnTariffText("001;EUR;250;79;15;1"),
            measurement("2026-03-12T14:45:00.000Z", 987.321,
                        "2026-03-12T15:22:00.000Z", 991.654)
        );

        expect(costs).toBeDefined();
        expect(costs?.chargedEnergyKWh.toNumber()).toBe(4.333);
        expect(costs?.billableMinutes).toBe(36);
        expect(costs?.totalPrice.toFixed(5)).toBe("11.32307");

    });

    test("rounds every started blocking minute up", () => {

        const costs = calculateBETTariffTotal(
            parseOCMFBonnTariffText("001;EUR;0;0;15;1"),
            measurement("2026-03-12T14:45:00.000Z", 10,
                        "2026-03-12T14:46:01.000Z", 10)
        );

        expect(costs?.billableMinutes).toBe(1);
        expect(costs?.totalPrice.toFixed(2)).toBe("0.15");

    });

    test("calculates profile 002 without inventing post-charge blocking time", () => {

        const costs = calculateBETTariffTotal(
            parseOCMFBonnTariffText("002;EUR;199;69;20"),
            measurement("2026-06-15T17:05:00.000Z", 8080.808,
                        "2026-06-15T18:35:00.000Z", 8091.919)
        );

        expect(costs?.chargedEnergyKWh.toNumber()).toBe(11.111);
        expect(costs?.billableMinutes).toBe(0);
        expect(costs?.totalPrice.toFixed(5)).toBe("9.65659");

    });

    test("calculates profile 003 from the rounded charging duration", () => {

        const costs = calculateBETTariffTotal(
            parseOCMFBonnTariffText("003;EUR;150;12"),
            measurement("2026-09-18T19:30:00.000Z", 9999.001,
                        "2026-09-18T20:10:00.000Z", 10005.501)
        );

        expect(costs?.billableMinutes).toBe(40);
        expect(costs?.totalPrice.toFixed(2)).toBe("6.30");

    });

    test("normalizes watt-hour measurements for energy tariffs", () => {

        const costs = calculateBETTariffTotal(
            parseOCMFBonnTariffText("001;EUR;100;50;0;120"),
            measurement("2026-01-01T10:00:00.000Z", 1000,
                        "2026-01-01T10:30:00.000Z", 3500,
                        "Wh")
        );

        expect(costs?.chargedEnergyKWh.toNumber()).toBe(2.5);
        expect(costs?.totalPrice.toFixed(2)).toBe("2.25");

    });

    test("bills energy in the predefined one-Wh steps", () => {

        const costs = calculateBETTariffTotal(
            parseOCMFBonnTariffText("001;EUR;0;50;0;120"),
            measurement("2026-01-01T10:00:00.000Z", 1,
                        "2026-01-01T10:30:00.000Z", 3.5001)
        );

        expect(costs?.chargedEnergyKWh.toNumber()).toBe(2.5001);
        expect(costs?.billedEnergyKWh.toNumber()).toBe(2.501);
        expect(costs?.totalPrice.toFixed(4)).toBe("1.2505");

    });

    test("rejects incomplete, decreasing or unsupported measurements", () => {

        const tariff = parseOCMFBonnTariffText("001;EUR;100;50;10;30");
        const unsupported = measurement("2026-01-01T10:00:00.000Z", 1,
                                        "2026-01-01T10:30:00.000Z", 2,
                                        "MWh");
        const decreasing  = measurement("2026-01-01T10:00:00.000Z", 2,
                                        "2026-01-01T10:30:00.000Z", 1);
        const incomplete  = measurement("2026-01-01T10:00:00.000Z", 1,
                                        "2026-01-01T10:30:00.000Z", 2);
        incomplete.values.pop();

        expect(calculateBETTariffTotal(tariff, unsupported)).toBeUndefined();
        expect(calculateBETTariffTotal(tariff, decreasing)).toBeUndefined();
        expect(calculateBETTariffTotal(tariff, incomplete)).toBeUndefined();

    });

});
