import { describe, expect, test } from 'vitest';
import {
    OCMFBonnTariffParseError,
    ocmfBonnTariffToChargingTariff,
    parseOCMFBonnTariffText,
    tryParseOCMFBonnTariffText,
    type IOCMFBonnTariff,
    type IChargingTariffElement
} from '@open-charging-cloud/chargy-core';


function elementShape(element: IChargingTariffElement | undefined): unknown {

    if (element === undefined)
        return undefined;

    return {
        price_components: element.price_components.map(component => ({
            type:      component.type,
            price:     component.price.toNumber(),
            step_size: component.step_size
        })),
        restrictions: element.restrictions
    };

}


function parseAndConvert(tariffText: string): {
    parsed:         IOCMFBonnTariff;
    firstElement:   unknown;
    secondElement:  unknown;
} {

    const parsed = parseOCMFBonnTariffText(tariffText);
    const tariff = ocmfBonnTariffToChargingTariff(parsed);

    expect(tariff).toMatchObject({
        "@id":    tariffText,
        currency: "EUR"
    });

    return {
        parsed,
        firstElement:  elementShape(tariff.elements?.[0]),
        secondElement: elementShape(tariff.elements?.[1])
    };

}


describe("BET OCMF Tariff Text Extension", () => {

    test("parses profile 001 and creates energy plus delayed blocking prices", () => {

        const result = parseAndConvert("001;EUR;100;59;10;120");

        expect(result.parsed).toEqual({
            raw:                        "001;EUR;100;59;10;120",
            code:                       "001",
            currency:                   "EUR",
            startFeeCents:              100,
            energyFeeCentsPerKWh:       59,
            blockingFeeCentsPerMinute:  10,
            blockingFeeStartMinute:     120
        });
        expect(result.firstElement).toEqual({
            price_components: [
                { type: "FLAT",   price: 1,    step_size: 1 },
                { type: "ENERGY", price: 0.59, step_size: 1 }
            ],
            restrictions: undefined
        });
        expect(result.secondElement).toEqual({
            price_components: [
                { type: "PARKING_TIME", price: 6, step_size: 60 }
            ],
            restrictions: {
                min_duration: 7200
            }
        });

    });

    test("parses profile 002 and creates blocking prices after charging", () => {

        const result = parseAndConvert("002;EUR;50;40;8");

        expect(result.parsed).toEqual({
            raw:                               "002;EUR;50;40;8",
            code:                              "002",
            currency:                          "EUR",
            startFeeCents:                     50,
            energyFeeCentsPerKWh:              40,
            blockingFeeCentsPerMinute:         8,
            blockingFeeStartsAfterCharging:    true
        });
        expect(result.firstElement).toEqual({
            price_components: [
                { type: "FLAT",   price: 0.5, step_size: 1 },
                { type: "ENERGY", price: 0.4, step_size: 1 }
            ],
            restrictions: undefined
        });
        expect(result.secondElement).toEqual({
            price_components: [
                { type: "PARKING_TIME", price: 4.8, step_size: 60 }
            ],
            restrictions: undefined
        });

    });

    test("parses profile 003 and creates a time-based price", () => {

        const result = parseAndConvert("003;EUR;25;6");

        expect(result.parsed).toEqual({
            raw:                    "003;EUR;25;6",
            code:                   "003",
            currency:               "EUR",
            startFeeCents:          25,
            timeFeeCentsPerMinute:  6
        });
        expect(result.firstElement).toEqual({
            price_components: [
                { type: "FLAT", price: 0.25, step_size: 1 },
                { type: "TIME", price: 3.6,  step_size: 60 }
            ],
            restrictions: undefined
        });
        expect(result.secondElement).toBeUndefined();

    });

    test("rejects malformed or unsupported tariff texts", () => {

        expect(() => parseOCMFBonnTariffText("001;USD;10;20;30;40")).toThrow(OCMFBonnTariffParseError);
        expect(() => parseOCMFBonnTariffText("001;EUR;10;20;30")).toThrow(OCMFBonnTariffParseError);
        expect(() => parseOCMFBonnTariffText("004;EUR;10;20")).toThrow(OCMFBonnTariffParseError);
        expect(() => parseOCMFBonnTariffText("003;EUR;-1;20")).toThrow(OCMFBonnTariffParseError);
        expect(tryParseOCMFBonnTariffText("ordinary free-form tariff text")).toBeUndefined();

    });

});
