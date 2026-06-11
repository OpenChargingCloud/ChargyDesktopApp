declare module "*.css";
declare module "*.scss";

declare module "asn1.js" {
    interface Asn1Builder {
        bitstr(): Asn1Builder;
        key(name: string): Asn1Builder;
        obj(...items: unknown[]): Asn1Builder;
        objid(): Asn1Builder;
        seq(): Asn1Builder;
        seqof(schema: Asn1Schema): Asn1Builder;
    }

    interface Asn1Schema {
        // asn1.js schemas return caller-defined object shapes.
        // Keep the default dynamic so legacy decode callsites keep their previous behaviour.
        decode<T = any>(data: Uint8Array | ArrayBuffer, encoding: string): T;
    }

    const asn1: {
        define: (name: string, body: (this: Asn1Builder) => void) => Asn1Schema;
    };

    export = asn1;
}
