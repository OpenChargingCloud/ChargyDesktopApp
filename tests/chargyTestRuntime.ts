import { createRequire } from "node:module";
import type {
    Chargy,
    I18NDictionary,
    LanguageStrings,
    ShowPKIDetailsFunction,
    IValidationRules,
    SignedJSONMessage
} from "@open-charging-cloud/chargy-core";


type ChargyConstructorArguments = ConstructorParameters<typeof Chargy>;

export type ModuleRequire = (id: string) => unknown;

export type ChargyTestDependencies = {
    elliptic:      ChargyConstructorArguments[2];
    moment:        ChargyConstructorArguments[3];
    asn1:          ChargyConstructorArguments[4];
    base32Decode:  ChargyConstructorArguments[5];
};

type ChargyConstructor = new (...args: ChargyConstructorArguments) => Chargy;

type CreateTestChargyOptions = {
    i18n?:            I18NDictionary;
    uiLanguages?:     LanguageStrings;
    showPKIDetails?:  ShowPKIDetailsFunction;
    validationRules?: IValidationRules;
};

const requireModule = createRequire(import.meta.url);
const chargyDependencies = loadChargyTestDependencies(requireModule);

export function loadChargyTestDependencies(requireModule: ModuleRequire): ChargyTestDependencies {

    return {
        elliptic:      requireModule("elliptic")      as ChargyConstructorArguments[2],
        moment:        requireModule("moment")        as ChargyConstructorArguments[3],
        asn1:          requireModule("asn1.js")       as ChargyConstructorArguments[4],
        base32Decode:  requireModule("base32-decode") as ChargyConstructorArguments[5]
    };

}

export function createTestChargy(ChargyClass: ChargyConstructor,
                                 options:     CreateTestChargyOptions = {}): Chargy
{

    ensureChargyTestDOM();

    return new ChargyClass(
        options.i18n            ?? {},
        options.uiLanguages     ?? [ "en" ],
        chargyDependencies.elliptic,
        chargyDependencies.moment,
        chargyDependencies.asn1,
        chargyDependencies.base32Decode,
        options.showPKIDetails  ?? ((): string => ""),
        options.validationRules
    );

}

export function parseI18NDictionary(json: string): I18NDictionary {
    const parsed: unknown = JSON.parse(json);
    return parsed as I18NDictionary;
}

export function mergeI18NDictionaries(...dictionaries: I18NDictionary[]): I18NDictionary {
    return dictionaries.reduce<I18NDictionary>(
        (merged, dictionary) => ({
            ...merged,
            ...dictionary
        }),
        {}
    );
}

export function parseValidationRules(json: string): IValidationRules {
    const parsed: unknown = JSON.parse(json);
    return parsed as IValidationRules;
}

export function parseJSONRecord(json: string): Record<string, unknown> {
    const parsed: unknown = JSON.parse(json);
    return parsed as Record<string, unknown>;
}

export function parseSignedJSONMessage(json: string): SignedJSONMessage {
    const parsed: unknown = JSON.parse(json);
    return parsed as SignedJSONMessage;
}




type DOMParserModule = {
    DOMParser: typeof globalThis.DOMParser;
};

const { DOMParser: TestDOMParser } = requireModule("@oozcitak/dom") as DOMParserModule;

class TestDOMMatrix {

    toString(): string {
        return "matrix(1, 0, 0, 1, 0, 0)";
    }

}

function defineTestGlobal(name: "DOMParser" | "DOMMatrix",
                          value: unknown): void {

    Object.defineProperty(globalThis, name, {
        configurable:  true,
        writable:      true,
        value
    });

}

export function ensureChargyTestDOM(): void {

    defineTestGlobal("DOMParser", TestDOMParser);

    if (typeof globalThis.DOMMatrix === "undefined")
        defineTestGlobal("DOMMatrix", TestDOMMatrix);

}

export function parseTestXML(xml: string): Document {

    ensureChargyTestDOM();
    return new TestDOMParser().parseFromString(xml, "text/xml");

}
