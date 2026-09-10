// Generates ocmf_withIF.xml from ocmf.xml.
//
// The real BSM WS36A document in ocmf.xml carries no Identification Flags,
// so the "IF" branch of the OCMF parser had no fixture at all: ocmf_withIF.xml
// supplies one. IF sits inside the signed payload, so the document cannot be
// edited by hand — adding the field invalidates the vendor signature, and the
// BSM private key is not available. This regenerates a complete document and
// signs it with a key created here, which is why the public key in the
// resulting fixture differs from the vendor one.
//
// Run from the repository root:
//
//     node tests/fixtures/chargeIT/bsm/generate_ocmf_withIF.mjs
//
// Deterministic apart from the key pair, so re-running it only changes the
// signature and the public key.

import { readFileSync, writeFileSync } from "node:fs";
import { generateKeyPairSync, sign as signData } from "node:crypto";

const directory = new URL(".", import.meta.url);
const source    = readFileSync(new URL("ocmf.xml", directory), "utf8");

// The two signed OCMF documents of the original: Transaction.Begin and .End.
const documents = [ ...source.matchAll(
                        /<signedData format="OCMF" encoding="plain">(OCMF\|.*?)<\/signedData>/gs
                    ) ].map(match => match[1]);

if (documents.length !== 2)
    throw new Error(`Expected two OCMF documents in ocmf.xml, found ${documents.length}!`);

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });

const publicKeyHEX = publicKey.export({ format: "der", type: "spki" }).toString("hex");

// The payload is signed as the exact string it appears as, so it is assembled
// by hand rather than through JSON.stringify of a reordered object. IF is
// placed between IS and IT, which is the order the OCMF specification lists
// the identification fields in.
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

const values = documents.map((ocmfDocument, index) =>
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
