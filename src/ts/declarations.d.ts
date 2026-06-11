declare module "*.css";
declare module "*.scss";

declare module "asn1.js" {
    const asn1: {
        define: (name: string, body: (this: unknown) => void) => unknown;
    };

    export = asn1;
}
