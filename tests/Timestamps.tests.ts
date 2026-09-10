import { afterEach, describe, expect, test } from 'vitest';
import {
    SetTimestamp,
    SetTimestamp32,
    meterTimeZone,
    timeZoneOffsetMinutes
} from '@open-charging-cloud/chargy-core';

// EMH and GDF meters sign their own local time, so the bytes that go into the
// signed buffer must depend on the record alone. A charge transparency record
// that verifies in Berlin has to verify identically on a UTC build server.
describe("Signed timestamps", () => {

    const originalTZ = process.env["TZ"];

    afterEach(() => {

        if (originalTZ === undefined)
            delete process.env["TZ"];
        else
            process.env["TZ"] = originalTZ;

    });

    const timeZones = [ "Europe/Berlin", "UTC", "America/New_York", "Pacific/Auckland", "Asia/Kolkata" ];

    function timestamp32In(timeZone: string, timestamp: string): string {

        process.env["TZ"] = timeZone;

        return SetTimestamp32(new DataView(new ArrayBuffer(16)), timestamp, 0);

    }

    test.each([
        [ "an explicit UTC offset", "2019-02-19T08:47:50+01:00" ],
        [ "a UTC timestamp",        "2019-02-19T07:47:50Z"      ],
        [ "no zone at all",         "2019-02-19T08:47:50"       ],
        [ "a summer timestamp",     "2019-06-26T15:33:20Z"      ]
    ])("writes the same bytes in every time zone for %s", (_description, timestamp) => {

        const results = timeZones.map(timeZone => timestamp32In(timeZone, timestamp));

        expect(new Set(results).size).toBe(1);

    });

    test("uses the offset the record states about the meter", () => {

        expect(timestamp32In("Pacific/Auckland", "2019-02-19T08:47:50+01:00")).
            toBe(timestamp32In("UTC", "2019-02-19T08:47:50+01:00"));

        // What ends up signed is the meter's local wall clock time. These two
        // denote different instants but the same local reading of 08:47:50, so
        // they have to produce the same bytes.
        expect(timestamp32In("UTC", "2019-02-19T08:47:50+01:00")).
            toBe(timestamp32In("UTC", "2019-02-19T08:47:50+05:00"));

        // Whereas the same instant read as a different local time must not.
        expect(timestamp32In("UTC", "2019-02-19T08:47:50+01:00")).
            not.toBe(timestamp32In("UTC", "2019-02-19T09:47:50+02:00"));

    });

    test("assumes the German meter time zone when the record states no offset", () => {

        // Same instant, once as UTC and once with the German offset spelled out:
        // both have to reconstruct to the same signed bytes.
        expect(timestamp32In("UTC", "2019-02-19T07:47:50Z")).
            toBe(timestamp32In("UTC", "2019-02-19T08:47:50+01:00"));

        // And in summer, where Germany is two hours ahead.
        expect(timestamp32In("UTC", "2019-06-26T15:33:20Z")).
            toBe(timestamp32In("UTC", "2019-06-26T17:33:20+02:00"));

    });

    test("leaves the timestamp untouched when no local offset is wanted", () => {

        // Alfen passes addLocalOffset = false, so nothing may be added at all.
        const withoutOffset = (timeZone: string): string => {
            process.env["TZ"] = timeZone;
            return SetTimestamp32(new DataView(new ArrayBuffer(16)), "2019-06-26T15:33:20Z", 0, false);
        };

        expect(new Set(timeZones.map(withoutOffset)).size).toBe(1);
        expect(withoutOffset("UTC")).not.toBe(timestamp32In("UTC", "2019-06-26T15:33:20Z"));

    });

    test("applies the same rules to the 64 bit variant used by GDF", () => {

        const results = timeZones.map(timeZone => {
            process.env["TZ"] = timeZone;
            return SetTimestamp(new DataView(new ArrayBuffer(16)), "2019-06-26T15:33:20Z", 0);
        });

        expect(new Set(results).size).toBe(1);

    });

    test("resolves the German offset including daylight saving time", () => {

        expect(meterTimeZone).toBe("Europe/Berlin");

        expect(timeZoneOffsetMinutes(new Date("2019-02-19T07:47:50Z"))).toBe(60);
        expect(timeZoneOffsetMinutes(new Date("2019-06-26T15:33:20Z"))).toBe(120);

        // The European changeover happens at 01:00 UTC on the last Sunday in March.
        expect(timeZoneOffsetMinutes(new Date("2019-03-31T00:59:00Z"))).toBe(60);
        expect(timeZoneOffsetMinutes(new Date("2019-03-31T01:01:00Z"))).toBe(120);

    });

    test("resolves other time zones on request", () => {

        expect(timeZoneOffsetMinutes(new Date("2019-02-19T07:47:50Z"), "UTC")).toBe(0);
        expect(timeZoneOffsetMinutes(new Date("2019-02-19T07:47:50Z"), "Asia/Kolkata")).toBe(330);

    });

});
