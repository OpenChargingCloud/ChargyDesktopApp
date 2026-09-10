import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import { verifyChargeData } from "./testHelper";
import { IsAChargeTransparencyRecord } from "@open-charging-cloud/chargy-core";
import type { IChargeTransparencyRecord } from "@open-charging-cloud/chargy-core";

const currentDirectory = fileURLToPath(new URL(".", import.meta.url));

function readFixture(...segments: string[]): string {
    return readFileSync(join(currentDirectory, "fixtures", ...segments), "utf8");
}

async function parseFixture(...segments: string[]): Promise<IChargeTransparencyRecord> {

    const result = await verifyChargeData(segments[segments.length - 1] ?? "", readFixture(...segments));

    if (!IsAChargeTransparencyRecord(result))
        throw new Error(`${segments.join("/")} did not parse into a charge transparency record!`);

    return result;

}

// OCMF carries neither a session identifier nor an explicit start and end, so
// ChargyCore derives all three from the documents. Both have to be reproducible:
// verifying the same record twice must produce the same report.
describe("OCMF session identity", () => {

    test("derives an id from the document instead of using a constant", async () => {

        const ctr = await parseFixture("OCMF", "OCMF-Testdata-01.ocmf");

        expect(ctr.chargingSessions?.[0]?.["@id"]).toMatch(/^OCMF-[0-9a-f]{64}$/);

    });

    test("gives the same record the same id every time", async () => {

        const first  = await parseFixture("OCMF", "OCMF-Testdata-01.ocmf");
        const second = await parseFixture("OCMF", "OCMF-Testdata-01.ocmf");

        expect(first.chargingSessions?.[0]?.["@id"]).
            toBe(second.chargingSessions?.[0]?.["@id"]);

    });

    // The id must describe the record, not the bytes it happened to arrive as.
    // DZG data is pretty-printed JSON spanning dozens of lines, so a checkout
    // that rewrites line endings — the default on Windows — used to change it.
    test("gives the same id whatever the line endings are", async () => {

        const lf   = readFixture("OCMF", "OCMF-DZG-01.ocmf").replace(/\r\n/g, "\n");
        const crlf = lf.replace(/\n/g, "\r\n");

        expect(crlf).not.toBe(lf);

        const idOf = async (text: string): Promise<string | undefined> => {

            const result = await verifyChargeData("OCMF-DZG-01.ocmf", text);

            if (!IsAChargeTransparencyRecord(result))
                throw new Error("Did not parse into a charge transparency record!");

            return result.chargingSessions?.[0]?.["@id"];

        };

        expect(await idOf(crlf)).toBe(await idOf(lf));

    });

    test("gives different records different ids", async () => {

        const testdata = await parseFixture("OCMF", "OCMF-Testdata-01.ocmf");
        const dzg      = await parseFixture("OCMF", "OCMF-DZG-01.ocmf");

        const testdataId = testdata.chargingSessions?.[0]?.["@id"];
        const dzgId      = dzg     .chargingSessions?.[0]?.["@id"];

        expect(testdataId).toBeDefined();
        expect(dzgId).toBeDefined();
        expect(testdataId).not.toBe(dzgId);

    });

    test("takes the session start and end from the readings", async () => {

        const ctr     = await parseFixture("OCMF", "OCMF-DZG-01.ocmf");
        const session = ctr.chargingSessions?.[0];

        expect(session).toBeDefined();
        expect(session?.begin).not.toBe("?");
        expect(session?.end).not.toBe("?");

        const timestamps = (session?.measurements ?? []).
                               flatMap(measurement => measurement.values).
                               map    (value       => Date.parse(value.timestamp)).
                               filter (instant     => !Number.isNaN(instant));

        expect(timestamps.length).toBeGreaterThan(0);
        expect(Date.parse(session?.begin ?? "")).toBe(Math.min(...timestamps));
        expect(Date.parse(session?.end   ?? "")).toBe(Math.max(...timestamps));
        expect(Date.parse(session?.begin ?? "")).toBeLessThanOrEqual(Date.parse(session?.end ?? ""));

    });

    test("mirrors the session timespan onto the record", async () => {

        const ctr     = await parseFixture("OCMF", "OCMF-DZG-01.ocmf");
        const session = ctr.chargingSessions?.[0];

        expect(ctr.begin).toBe(session?.begin);
        expect(ctr.end).toBe(session?.end);
        expect(ctr.begin).not.toBe("?");

    });

});
