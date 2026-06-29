import {
    createECDH,
    createPrivateKey,
    createPublicKey,
    sign as signData,
    type KeyObject
} from 'node:crypto';


export const supportedOCMFVersions = [ "0.1", "1.0", "1.1", "1.2", "1.3", "1.4" ] as const;

export type SupportedOCMFVersion = typeof supportedOCMFVersions[number];
export type OCMFChargePointIdentificationType = "EVSEID" | "CBIDC";

export interface OCMFVersionTestData {
    version:                       SupportedOCMFVersion;
    includesFormatVersion:         boolean;
    document:                      string;
    publicKeyBase64:               string;
    payload:                       Record<string, unknown>;
    expected: {
        gatewayInformation:            string;
        gatewaySerial?:                string | undefined;
        gatewayVersion:                string;
        meterVendor:                   string;
        meterModel:                    string;
        meterSerial:                   string;
        meterFirmware:                 string;
        identificationStatus:          boolean | string;
        identificationType:            string;
        identificationData:            string;
        tariffText?:                   string | undefined;
        tariffProfile?:                "001" | "002" | "003" | undefined;
        controllerFirmwareVersion?:    string | undefined;
        lossCompensation?: {
            LN?: string | undefined;
            LI?: number | undefined;
            LR:  number;
            LU:  string;
        } | undefined;
        chargePointIdentificationType?: string | undefined;
        chargePointIdentification?:     string | undefined;
        chargingStationId?:             string | undefined;
        EVSEId?:                        string | undefined;
        connectorId?:                   string | undefined;
        pagination:                    number;
        obis:                          string;
        unit:                          string;
        beginTimestamp:                string;
        endTimestamp:                  string;
        beginValue:                    number;
        endValue:                      number;
        cumulatedLoss?:                number | undefined;
        errorIndex?:                   number | undefined;
    };
}


class SeededRandom {

    private state: number;

    constructor(seed: string) {
        this.state = hashSeed(seed) || 0x6D2B79F5;
    }

    public nextUint32(): number {
        let value = this.state;
        value    ^= value << 13;
        value    ^= value >>> 17;
        value    ^= value << 5;
        this.state = value >>> 0;
        return this.state;
    }

    public integer(minimum: number, maximum: number): number {
        return minimum + (this.nextUint32() % (maximum - minimum + 1));
    }

    public decimal(minimum: number, maximum: number, digits: number): number {
        const factor = 10 ** digits;
        return this.integer(minimum * factor, maximum * factor) / factor;
    }

    public hex(length: number): string {
        let result = "";
        while (result.length < length)
            result += this.nextUint32().toString(16).padStart(8, "0");
        return result.slice(0, length).toUpperCase();
    }

    public bytes(length: number): Buffer {
        const result = Buffer.alloc(length);
        for (let index = 0; index < length; index++)
            result[index] = this.nextUint32() & 0xFF;
        return result;
    }

}


function hashSeed(seed: string): number {
    let hash = 0x811C9DC5;
    for (const character of seed) {
        hash ^= character.charCodeAt(0);
        hash  = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}


function createDeterministicP256Key(random: SeededRandom): KeyObject {

    const privateKeyBytes = random.bytes(32);

    // Keeping the scalar below 2^255 guarantees that it is below the P-256
    // group order. Ensure that it is non-zero as well.
    privateKeyBytes[0]  = (privateKeyBytes[0]  ?? 0) & 0x7F;
    privateKeyBytes[31] = (privateKeyBytes[31] ?? 0) | 0x01;

    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(privateKeyBytes);

    const publicPoint = ecdh.getPublicKey(undefined, "uncompressed");

    return createPrivateKey({
        key: {
            kty: "EC",
            crv: "P-256",
            d:   privateKeyBytes.     toString("base64url"),
            x:   publicPoint.subarray(1,  33).toString("base64url"),
            y:   publicPoint.subarray(33, 65).toString("base64url")
        },
        format: "jwk"
    });

}


function isAtLeast(version: SupportedOCMFVersion,
                   minimum: Exclude<SupportedOCMFVersion, "0.1">): boolean
{
    if (version === "0.1")
        return false;

    return supportedOCMFVersions.indexOf(version) >= supportedOCMFVersions.indexOf(minimum);
}


function ocmfTimestamp(timestamp: Date): string {
    return timestamp.toISOString().replace(".000Z", ",000+0000 S");
}


export function createOCMFVersionTestData(version:               SupportedOCMFVersion,
                                          includesFormatVersion: boolean,
                                          forcedChargePointType?: OCMFChargePointIdentificationType): OCMFVersionTestData
{

    // The semantic values are stable per version. Only inclusion of FV and the
    // resulting signature differ between the two variants of a version test.
    const random = new SeededRandom("ChargyCore OCMF " + version);

    const gatewayInformation = version === "0.1"
                                   ? "LegacyVendor-" + random.hex(6)
                                   : "Gateway-"      + random.hex(6);
    const gatewaySerial      = version === "0.1" ? undefined : "GS" + random.hex(12);
    const gatewayVersion     = `${random.integer(1, 9)}.${random.integer(0, 99)}`;
    const meterVendor        = "MeterVendor-" + random.hex(4);
    const meterModel         = "Model-"       + random.hex(6);
    const meterSerial        = "MS"           + random.hex(14);
    const meterFirmware      = `${random.integer(1, 9)}.${random.integer(0, 99)}`;
    const identificationType = "ISO14443";
    const identificationData = random.hex(14);
    const pagination         = random.integer(1, 999999);
    const useEVSEId          = forcedChargePointType !== undefined
                                   ? forcedChargePointType === "EVSEID"
                                   : version !== "0.1" && random.integer(0, 1) === 0;
    const randomizedType: OCMFChargePointIdentificationType = useEVSEId ? "EVSEID" : "CBIDC";
    const chargePointType    = version === "0.1"
                                   ? undefined
                                   : forcedChargePointType ?? randomizedType;
    const chargingStationId  = chargePointType === "CBIDC" ? `CP-${random.hex(10)}` : undefined;
    const EVSEId             = chargePointType === "EVSEID" ? `DE*RND*E${random.integer(1000000, 9999999)}` : undefined;
    const connectorId        = chargePointType === "CBIDC" ? random.integer(1, 8).toString() : undefined;
    const chargePointId      = chargePointType === "EVSEID"
                                   ? EVSEId
                                   : chargePointType === "CBIDC"
                                         ? `${chargingStationId} ${connectorId}`
                                         : undefined;
    const beginValue         = random.decimal(100, 5000, 3);
    const endValue           = Number((beginValue + random.decimal(1, 100, 3)).toFixed(3));
    const beginTimestampDate = new Date(Date.UTC(
        random.integer(2020, 2025),
        random.integer(0, 11),
        random.integer(1, 20),
        random.integer(0, 20),
        random.integer(0, 40),
        0
    ));
    const endTimestampDate   = new Date(beginTimestampDate.getTime() + random.integer(5, 120) * 60_000);
    const beginTimestamp     = beginTimestampDate.toISOString().replace(".000Z", ".000+00:00");
    const endTimestamp       = endTimestampDate.  toISOString().replace(".000Z", ".000+00:00");
    const obis               = version === "0.1"
                                   ? "1-b:1.8.e"
                                   : version === "1.4"
                                         ? "01-00:01.08.00*FF"
                                         : "1-b:1.8.0";
    const identificationStatus: boolean | string = version === "0.1" ? "VERIFIED" : true;

    const payload: Record<string, unknown> = {};

    if (includesFormatVersion)
        payload["FV"] = version;

    if (version === "0.1") {
        payload["VI"] = gatewayInformation;
        payload["VV"] = gatewayVersion;
    }
    else {
        payload["GI"] = gatewayInformation;
        payload["GV"] = gatewayVersion;
    }

    if (gatewaySerial !== undefined)
        payload["GS"] = gatewaySerial;
    payload["PG"] = `T${pagination}`;
    payload["MV"] = meterVendor;
    payload["MM"] = meterModel;
    payload["MS"] = meterSerial;
    payload["MF"] = meterFirmware;
    payload["IS"] = identificationStatus;

    if (version !== "0.1")
        payload["IL"] = "TRUSTED";

    payload["IF"] = [ "RFID_PLAIN", "OCPP_AUTH_TLS" ];
    payload["IT"] = identificationType;
    payload["ID"] = identificationData;
    if (chargePointType !== undefined)
        payload["CT"] = chargePointType;
    if (chargePointId !== undefined)
        payload["CI"] = chargePointId;

    const tariffProfile = isAtLeast(version, "1.1")
                              ? ([ "001", "002", "003" ] as const)[random.integer(0, 2)]
                              : undefined;
    const tariffText    = tariffProfile === "001"
                              ? `001;EUR;${random.integer(0, 500)};${random.integer(1, 100)};${random.integer(1, 50)};${random.integer(1, 240)}`
                              : tariffProfile === "002"
                                    ? `002;EUR;${random.integer(0, 500)};${random.integer(1, 100)};${random.integer(1, 50)}`
                                    : tariffProfile === "003"
                                          ? `003;EUR;${random.integer(0, 500)};${random.integer(1, 100)}`
                                          : undefined;
    if (tariffText !== undefined)
        payload["TT"] = tariffText;

    const lossCompensation = isAtLeast(version, "1.2")
                                 ? {
                                       LN: "Cable-" + random.hex(4),
                                       LI: random.integer(1, 999),
                                       LR: random.decimal(1, 20, 3),
                                       LU: "mOhm"
                                   }
                                 : undefined;
    if (lossCompensation !== undefined)
        payload["LC"] = lossCompensation;

    const controllerFirmwareVersion = isAtLeast(version, "1.3")
                                          ? `${random.integer(1, 9)}.${random.integer(0, 999)}`
                                          : undefined;
    if (controllerFirmwareVersion !== undefined)
        payload["CF"] = controllerFirmwareVersion;

    const cumulatedLoss = isAtLeast(version, "1.2")
                              ? random.decimal(1, 10, 3)
                              : undefined;
    const errorIndex    = version === "0.1"
                              ? random.integer(1, 9999)
                              : undefined;

    const beginReading: Record<string, unknown> = {
        TM: ocmfTimestamp(beginTimestampDate),
        TX: "B",
        RV: beginValue,
        RI: obis,
        RU: "kWh",
        RT: "AC",
        ST: "G"
    };
    const endReading: Record<string, unknown> = {
        TM: ocmfTimestamp(endTimestampDate),
        TX: "E",
        RV: endValue,
        RI: obis,
        RU: "kWh",
        RT: "AC",
        ST: "G"
    };

    if (version === "0.1") {
        beginReading["EI"] = errorIndex;
        endReading["EI"]   = errorIndex;
    }
    else {
        beginReading["EF"] = "";
        endReading["EF"]   = "";
    }

    if (cumulatedLoss !== undefined) {
        beginReading["CL"] = 0;
        endReading["CL"]   = cumulatedLoss;
    }

    payload["RD"] = [ beginReading, endReading ];

    const rawPayload = JSON.stringify(payload);
    const privateKey = createDeterministicP256Key(random);
    const signature  = signData(
        "sha256",
        Buffer.from(rawPayload, "utf8"),
        {
            key:         privateKey,
            dsaEncoding: "der"
        }
    );
    const publicKey = createPublicKey(privateKey).export({
        format: "der",
        type:   "spki"
    });
    const signatureDocument = {
        SA: "ECDSA-secp256r1-SHA256",
        SE: "hex",
        SM: "application/x-der",
        SD: signature.toString("hex").toUpperCase()
    };

    return {
        version,
        includesFormatVersion,
        document: `OCMF|${rawPayload}|${JSON.stringify(signatureDocument)}`,
        publicKeyBase64: publicKey.toString("base64"),
        payload,
        expected: {
            gatewayInformation,
            gatewaySerial,
            gatewayVersion,
            meterVendor,
            meterModel,
            meterSerial,
            meterFirmware,
            identificationStatus,
            identificationType,
            identificationData,
            tariffText,
            tariffProfile,
            controllerFirmwareVersion,
            lossCompensation,
            chargePointIdentificationType: chargePointType,
            chargePointIdentification:     chargePointId,
            chargingStationId,
            EVSEId,
            connectorId,
            pagination,
            obis,
            unit: "kWh",
            beginTimestamp,
            endTimestamp,
            beginValue,
            endValue,
            cumulatedLoss,
            errorIndex
        }
    };

}
