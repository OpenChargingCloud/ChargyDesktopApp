// Generates ocmf_withIF.xml from ocmf.xml.
//
// The real BSM WS36A document in ocmf.xml carries no Identification Flags,
// so this fixture supplies the IF branch. IF sits inside the signed payload,
// therefore the document must be regenerated and signed rather than edited.
//
// Run from the repository root:
//
//     node tests/fixtures/chargeIT/bsm/generate_ocmf_withIF.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { generateKeyPairSync, sign as signData } from "node:crypto";

const directory = new URL(".", import.meta.url);
const source    = readFileSync(new URL("ocmf.xml", directory), "utf8");
const documents = [ ...source.matchAll(
                        /<signedData format="OCMF" encoding="plain">(OCMF\|.*?)<\/signedData>/gs
                    ) ].map(match => match[1]);

if (documents.length !== 2)
    throw new Error(`Expected two OCMF documents in ocmf.xml, found ${documents.length}!`);

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const publicKeyHEX              = publicKey.export({ format: "der", type: "spki" }).toString("hex");

function withIdentificationFlags(ocmfDocument) {

    const [ , rawPayload ] = ocmfDocument.split("|");
    const flags            = '"IF":["RFID_PLAIN","OCPP_AUTH"],';

    if (!rawPayload.includes('"IS":'))
        throw new Error("Payload has no IS field to anchor IF to!");

    const payloadWithIF = rawPayload.replace(/("IS":(?:true|false|"[^"]*"),)/, `$1${flags}`);

    if (payloadWithIF === rawPayload)
        throw new Error("Could not insert the IF field!");

    const signature = signData("sha256", Buffer.from(payloadWithIF, "utf8"), {
                          key:         privateKey,
                          dsaEncoding: "der"
                      });

    return "OCMF|" + payloadWithIF + "|" + JSON.stringify({
        SA: "ECDSA-secp256r1-SHA256",
        SD: signature.toString("hex")
    });

}

const contexts = [ "Transaction.Begin", "Transaction.End" ];
const values   = documents.map((ocmfDocument, index) =>
    `  <value transactionId="1" context="${contexts[index]}">\n` +
    `    <signedData format="OCMF" encoding="plain">${withIdentificationFlags(ocmfDocument)}</signedData>\n` +
    `    <publicKey encoding="hex">${publicKeyHEX}</publicKey>\n` +
    `  </value>`
).join("\n");

writeFileSync(
    new URL("ocmf_withIF.xml", directory),
    `<?xml version="1.0" encoding="ISO-8859-1" standalone="yes"?>\n<values>\n${values}\n</values>\n`,
    "utf8"
);

console.log("Wrote ocmf_withIF.xml");
