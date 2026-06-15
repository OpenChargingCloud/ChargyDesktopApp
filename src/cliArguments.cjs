function normalizeSwitchName(name) {
    return name.toLowerCase();
}

const supportedLanguages = [ "de", "en" ];

function normalizeLanguage(language) {

    if (typeof language !== "string" || language.trim() === "")
        return null;

    const normalized = language.trim()
                               .toLowerCase()
                               .replace("_", "-")
                               .split(".")[0];

    for (const supportedLanguage of supportedLanguages) {
        if (normalized === supportedLanguage || normalized.startsWith(supportedLanguage + "-"))
            return supportedLanguage;
    }

    return null;

}

function detectDefaultLanguage(environment) {

    const env = environment ?? {};

    return normalizeLanguage(env["LC_ALL"])      ??
           normalizeLanguage(env["LC_MESSAGES"]) ??
           normalizeLanguage(env["LANG"])        ??
           "en";

}

function parseSwitch(argument) {

    if (typeof argument !== "string" || !argument.startsWith("--"))
        return null;

    const equalsIndex = argument.indexOf("=");

    if (equalsIndex >= 0) {
        return {
            name:  normalizeSwitchName(argument.substring(2, equalsIndex)),
            value: argument.substring(equalsIndex + 1)
        };
    }

    return {
        name:  normalizeSwitchName(argument.substring(2)),
        value: null
    };

}

function invalidHttpSwitch(host, value) {
    return {
        enabled: true,
        host,
        port:    0,
        raw:     value,
        error:   "Invalid TCP port for chargy HTTP API: " + value
    };
}

function parseHttpSwitch(value) {

    if (value == null || value === "") {
        return {
            enabled: true,
            host:    "localhost",
            port:    8080,
            raw:     value ?? ""
        };
    }

    let host     = "localhost";
    let portText = value;

    if (value.startsWith("[")) {

        // Bracketed IPv6 literal, optionally followed by ":port", e.g. "[::1]" or "[::1]:8080".
        const closingBracketIndex = value.indexOf("]");

        if (closingBracketIndex < 0)
            return invalidHttpSwitch(value, value);

        host = value.substring(0, closingBracketIndex + 1);

        const remainder = value.substring(closingBracketIndex + 1);

        // "[::1]" without an explicit port falls back to the default port.
        if (remainder === "")
            return { enabled: true, host, port: 8080, raw: value };

        if (!remainder.startsWith(":"))
            return invalidHttpSwitch(host, value);

        portText = remainder.substring(1);

    }
    else {

        const firstColonIndex = value.indexOf(":");
        const lastColonIndex  = value.lastIndexOf(":");

        if (firstColonIndex >= 0 && firstColonIndex === lastColonIndex) {
            // Exactly one colon: "host:port".
            host     = value.substring(0, lastColonIndex);
            portText = value.substring(lastColonIndex + 1);
        }
        else if (firstColonIndex >= 0) {
            // Multiple colons without brackets: a bare IPv6 literal without a port, e.g. "::1".
            return { enabled: true, host: value, port: 8080, raw: value };
        }
        // No colon: a bare port (host stays "localhost").

    }

    const port = parseInt(portText, 10);

    if (isNaN(port) || port < 0 || port > 65535)
        return invalidHttpSwitch(host, value);

    return {
        enabled: true,
        host,
        port,
        raw: value
    };

}

function getLocalizedText(i18n, language, key, fallback) {

    const translations = i18n?.[key];

    if (translations != null) {
        const localized = translations[language];
        if (typeof localized === "string")
            return localized;

        const english = translations["en"];
        if (typeof english === "string")
            return english;
    }

    return fallback;

}

function parseCliArguments(args, environment = process.env) {

    const switches = new Map();
    const files    = [];

    let helpTopic = null;
    let language   = null;
    let languageSet = false;

    for (let i = 0; i < args.length; i++) {

        const argument = args[i];
        const parsed   = parseSwitch(argument);

        if (parsed != null) {
            switches.set(parsed.name, parsed.value);

            if (parsed.name === "help") {
                const nextArgument = args[i + 1];
                if (typeof nextArgument === "string" && !nextArgument.startsWith("-")) {
                    helpTopic = nextArgument.toLowerCase();
                    i++;
                }
            }

            if (parsed.name === "lang") {
                languageSet = true;

                if (parsed.value != null)
                {
                    // --lang=de form
                    language = normalizeLanguage(parsed.value);
                }
                else
                {
                    // --lang de form: only consume the next argument when it is a
                    // recognized language, so a following file argument such as
                    // "session.chargy" is never swallowed as a language value.
                    const nextLanguage = normalizeLanguage(args[i + 1]);

                    if (nextLanguage != null)
                    {
                        switches.set(parsed.name, args[i + 1]);
                        language = nextLanguage;
                        i++;
                    }
                }
            }

            if (parsed.name === "apikeys") {
                if (parsed.value == null) {
                    const nextArgument = args[i + 1];
                    if (typeof nextArgument === "string" && !nextArgument.startsWith("-")) {
                        switches.set(parsed.name, nextArgument);
                        i++;
                    }
                }
            }

            continue;
        }

        if (typeof argument === "string")
            files.push(argument);

    }

    const httpValue = switches.has("http")
                          ? switches.get("http")
                          : undefined;

    return {
        switches,
        files,
        help:      switches.has("help"),
        helpTopic,
        language:  language ?? (languageSet ? "en" : detectDefaultLanguage(environment)),
        version:   switches.has("version"),
        inspect:   switches.has("inspect"),
        noGUI:     switches.has("nogui"),
        output:    switches.has("output") ? (switches.get("output") ?? "") : null,
        apiKeys:   switches.has("apikeys") ? (switches.get("apikeys") ?? "") : null,
        http:      httpValue !== undefined
                       ? parseHttpSwitch(httpValue)
                       : {
                             enabled: false,
                             host:    "",
                             port:    0,
                             raw:     ""
                         }
    };

}

// True when the CLI was started in headless mode (--nogui) but has nothing to do:
// no file to verify and no HTTP API. The caller should then show the usage help
// and exit cleanly instead of starting an invisible renderer that never finishes.
function hasNoActionableInput(cliArguments) {
    return cliArguments.noGUI === true &&
           cliArguments.files.length === 0 &&
           !cliArguments.http.enabled;
}

function createMainHelpText(applicationFileName, version, applicationEdition, copyright, language = "en", i18n = {}) {
    const lang = normalizeLanguage(language) ?? "en";

    return [
        "Chargy E-Mobility Transparency Software " + applicationEdition + " v" + version,
        copyright.replace("&copy;", "(c)"),
        "",
        getLocalizedText(i18n, lang, "CLIUsagePrefix", "Usage:") + " " + applicationFileName + " [switches] file1, file2, ...",
        "",
        getLocalizedText(i18n, lang, "CLISwitchesHeading", "Switches:"),
        " --help             " + getLocalizedText(i18n, lang, "CLIHelpDescription", "Show this information"),
        " --lang=de|en       " + getLocalizedText(i18n, lang, "CLILanguageDescription", "Set the CLI language"),
        " --inspect          " + getLocalizedText(i18n, lang, "CLIInspectDescription", "Run in debug mode, enable inspector and open development tools"),
        " --nogui            " + getLocalizedText(i18n, lang, "CLINoGUIDescription", "Run in command line mode (cli mode)"),
        " --http[=host:port] " + getLocalizedText(i18n, lang, "CLIHTTPDescription", "Start the HTTP API on localhost:8080 or the given endpoint"),
        " --apiKeys=file     " + getLocalizedText(i18n, lang, "CLIAPIKeysDescription", "Require HTTP API clients to send an API-Key request header listed in the JSON file")
    ].join("\n");
}

function createOutputHelpText(applicationFileName, version, applicationEdition, copyright, language = "en", i18n = {}) {
    const lang = normalizeLanguage(language) ?? "en";

    return [
        "Chargy E-Mobility Transparency Software " + applicationEdition + " v" + version,
        copyright.replace("&copy;", "(c)"),
        "",
        getLocalizedText(i18n, lang, "CLIUsagePrefix", "Usage:") + " " + applicationFileName + " --output=[text (default)|csv|json|xml|chargy] file1, file2, ...",
        "",
        getLocalizedText(i18n, lang, "CLIOutputHelpIntro", "Set the verification result output format in cli/debug mode"),
        "",
        " text               " + getLocalizedText(i18n, lang, "CLIOutputTextDescription", "The default human readable output format."),
        " csv                " + getLocalizedText(i18n, lang, "CLIOutputCSVDescription", "Use the CSV (comma separated values) format."),
        " json               " + getLocalizedText(i18n, lang, "CLIOutputJSONDescription", "Use the JSON format."),
        " xml                " + getLocalizedText(i18n, lang, "CLIOutputXMLDescription", "Use the XML format."),
        " chargy             " + getLocalizedText(i18n, lang, "CLIOutputChargyDescription", "In combination with '--export' include the verification results into the charge transparency file."),
        "",
        getLocalizedText(i18n, lang, "CLIOutputNotImplementedNote", "Note: These output formats are documented as CLI contract, but are not implemented yet.")
    ].join("\n");
}

module.exports = {
    detectDefaultLanguage,
    normalizeLanguage,
    getLocalizedText,
    parseCliArguments,
    hasNoActionableInput,
    createMainHelpText,
    createOutputHelpText
};
