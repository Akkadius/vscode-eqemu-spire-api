import * as vscode from "vscode";
import * as util from "util";
import {Strings} from "./Strings";

export class SpirePerlCompletions {
    private c: vscode.ExtensionContext;
    private constants: Array<any> = [];
    private methods: Array<any>   = [];

    constructor(c: vscode.ExtensionContext) {
        this.c = c;
    }

    /**
     * Loads constants auto completions into memory via API definitions
     * @param api
     */
    loadConstants(api: Object) {
        // @ts-ignore
        const apiConstants = api['perl'].constants;
        // constants
        this.constants     = [];
        // @ts-ignore
        for (const constantType in apiConstants) {
            // @ts-ignore
            const entries = apiConstants[constantType];
            for (let e of entries) {
                const constant = util.format(
                    "%s",
                    e.constant.replace(/\$/, "")
                );

                // console.log("constantType [%s] value [%s]", constantType, e.constant);

                const i      = new vscode.CompletionItem(constant);
                i.insertText = new vscode.SnippetString(constant);

                this.constants.push(i);
            }
        }
    }

    /**
     * Loads methods auto completions into memory via API definitions
     *
     * @param api
     */
    loadMethods(api: Object) {
        this.methods = [];
        // @ts-ignore
        for (const methodClass in api['perl'].methods) {
            // console.log("e", methodClass);
            const classPrefix = Strings.snakeCase(methodClass.replace("NPC", "Npc"));
            // console.log("classPrefix", classPrefix);

            // @ts-ignore
            for (const m of api['perl'].methods[methodClass]) {
                let snippetParams: Array<any> = [];
                m.params.forEach((p: any, i: number) => {
                    snippetParams.push(
                        util.format("${%s:%s}", (i + 1), p)
                    );
                });

                let label = util.format(
                    "%s(%s)",
                    m.method,
                    m.params.join(", ")
                );

                let snippet = util.format(
                    "%s(%s)",
                    m.method,
                    snippetParams.join(", ")
                );

                const i      = new vscode.CompletionItem(label);
                i.insertText = new vscode.SnippetString(snippet);
                i.kind       = vscode.CompletionItemKind.Snippet;
                i.detail     = methodClass;
                // @ts-ignore
                i.class      = classPrefix;
                this.methods.push(i);

            }
        }

        console.log(this.methods);
    }

    registerCompletionProvider() {

        // constants
        this.c.subscriptions.push(
            vscode.languages.registerCompletionItemProvider(
                'perl',
                {
                    provideCompletionItems: () => {
                        return this.constants;
                    }
                },
                "$"
            ),
        );

        // object methods and quest::
        this.c.subscriptions.push(
            vscode.languages.registerCompletionItemProvider(
                'perl',
                {
                    provideCompletionItems: (doc: vscode.TextDocument, position: vscode.Position) => {

                        console.log("[Perl] Completion trigger");
                        console.log("[Perl] Position", position);

                        let completionItems: Array<any> = [];

                        const activeEditor = vscode.window.activeTextEditor;
                        if (activeEditor !== null) {
                            // @ts-ignore
                            const lineTextToCursor = activeEditor.document.getText(new vscode.Range(position.line, 0, position.line, position.character));
                            if (lineTextToCursor && lineTextToCursor.length > 0) {
                                console.log("[Perl] line text up to cursor is [%s]", lineTextToCursor);

                                // accessing some sort of object
                                if (lineTextToCursor.slice(-2) === "->") {
                                    const split = lineTextToCursor.split("$");
                                    if (split.length > 0) {
                                        const classPrefix   = split[split.length - 1].replace(/->/, "");
                                        const classesToLoad = this.getCompletionPrefixesByPrefix(classPrefix);

                                        // use this later to tie completions to class
                                        console.log("[Perl] Accessing object, last is [%s]", classPrefix);

                                        // filter available auto-completions by class prefix
                                        for (let m of this.methods) {
                                            if (classesToLoad.includes(m.class)) {
                                                completionItems.push(m);
                                            }
                                        }
                                    }
                                }

                                // quest::
                                if (lineTextToCursor.slice(-2) === "::") {
                                    for (let m of this.methods) {
                                        if (m.class === "quest") {
                                            completionItems.push(m);
                                        }
                                    }
                                }
                            }
                        }

                        return completionItems;
                    },
                },
                ">", ":"
            ),
        );
    }

    /**
     * Loads class prefixes by a given prefix
     * For example if given "client" it will return [ "client", "mob" ] because client is an instance of mob
     * Another example is if given GetGroup it will return [ "group" ] to chain methods
     * @param classPrefix
     * @private
     */
    private getCompletionPrefixesByPrefix(classPrefix: string): Array<string> {
        let prefixes: Array<any> = [];
        let prefixMappings       = {
            "client": ["client", "mob", "entity"],
            "npc": ["npc", "mob", "entity"],
            "object": ["object", "entity"],
            "corpse": ["corpse", "mob", "entity"],
        };

        // @ts-ignore
        if (prefixMappings[classPrefix]) {
            // @ts-ignore
            prefixes = prefixes.concat(prefixMappings[classPrefix]);
        } else {
            prefixes = [classPrefix];
        }

        if (classPrefix.includes("GetGroup")) {
            prefixes = ["group"];
        }
        if (classPrefix.includes("GetRaid")) {
            prefixes = ["raid"];
        }
        if (classPrefix.includes("GetExpedition")) {
            prefixes = ["expedition"];
        }

        console.log("Completion prefixes are", prefixes);

        return prefixes;
    }
}
