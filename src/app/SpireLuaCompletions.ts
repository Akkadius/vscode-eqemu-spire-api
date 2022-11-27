import * as vscode from "vscode";
import * as util from "util";
import * as path from "path";
import {Strings} from "./Strings";

export class SpireLuaCompletions {
    private c: vscode.ExtensionContext;
    private constants: Array<any> = [];
    private methods: Array<any>   = [];

    constructor(c: vscode.ExtensionContext) {
        this.c = c;
    }

    // @ts-ignore
    loadConstants(api: Object) {
        this.constants = [];

        // @ts-ignore
        const apiConstants = api['lua'].constants;
        // @ts-ignore
        for (const key in apiConstants) {
            // @ts-ignore
            const entries = apiConstants[key];
            for (let e of entries) {
                const constant  = util.format(
                    "%s.%s",
                    key,
                    e.constant
                );
                const item      = new vscode.CompletionItem(constant);
                item.insertText = new vscode.SnippetString(constant);

                this.constants.push(item);
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
        for (const methodClass in api['lua'].methods) {
            // console.log("e", methodClass);
            const classPrefix = Strings.snakeCase(methodClass.replace("NPC", "Npc"));
            // console.log("classPrefix", classPrefix);

            // @ts-ignore
            for (const m of api['lua'].methods[methodClass]) {
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
                'lua',
                {
                    provideCompletionItems: (doc: vscode.TextDocument, position: vscode.Position) => {
                        const word = doc.getWordRangeAtPosition(position);
                        if (!word) {
                            return [];
                        }

                        // console.log("We have a range");

                        const range = new vscode.Range(
                            position.line,
                            word.start.character,
                            position.line,
                            word.end.character
                        );

                        // slight hack to keep from constants from autocompleting "then"
                        // revisit this later
                        if (doc.getText(range) === "t") {
                            return [];
                        }

                        // console.log("Text at range is [%s]", doc.getText(range));

                        const activeEditor = vscode.window.activeTextEditor;
                        if (activeEditor !== null) {
                            // @ts-ignore
                            const currentLine = activeEditor.selection.active.line;
                            // @ts-ignore
                            const {text}      = activeEditor.document.lineAt(activeEditor.selection.active.line);

                            // console.log("current line is", currentLine);
                            // console.log("current line text is", text);
                        }

                        return this.constants;
                    }
                },
            )
        );

        // object methods and eq.
        this.c.subscriptions.push(
            vscode.languages.registerCompletionItemProvider(
                'lua',
                {
                    provideCompletionItems: (doc: vscode.TextDocument, position: vscode.Position) => {

                        console.log("[Lua] Completion trigger");
                        console.log("[Lua] Position", position);

                        let completionItems: Array<any> = [];

                        const activeEditor = vscode.window.activeTextEditor;
                        if (activeEditor !== null) {
                            // @ts-ignore
                            const lineTextToCursor = activeEditor.document.getText(new vscode.Range(position.line, 0, position.line, position.character));
                            if (lineTextToCursor && lineTextToCursor.length > 0) {
                                console.log("[Lua] line text up to cursor is [%s]", lineTextToCursor);
                                console.log("[Lua] slice 6 [%s]", lineTextToCursor.slice(-6));
                                console.log("[Lua] filename [%s]", path.parse(doc.fileName).name);

                                const isPlayerScript = path.parse(doc.fileName).name.includes("player");

                                // [object] e.other: and not player script
                                if (lineTextToCursor.slice(-6) === "other:" && !isPlayerScript) {
                                    const classesToLoad = this.getCompletionPrefixesByPrefix("client");
                                    for (let m of this.methods) {
                                        if (classesToLoad.includes(m.class)) {
                                            completionItems.push(m);
                                        }
                                    }
                                }

                                // [object] e.self: and not player script
                                if (lineTextToCursor.slice(-5) === "self:" && !isPlayerScript) {
                                    const classesToLoad = this.getCompletionPrefixesByPrefix("npc");
                                    for (let m of this.methods) {
                                        if (classesToLoad.includes(m.class)) {
                                            completionItems.push(m);
                                        }
                                    }
                                }

                                // [object] e.self: and player script
                                if (lineTextToCursor.slice(-5) === "self:" && isPlayerScript) {
                                    const classesToLoad = this.getCompletionPrefixesByPrefix("client");
                                    for (let m of this.methods) {
                                        if (classesToLoad.includes(m.class)) {
                                            completionItems.push(m);
                                        }
                                    }
                                }

                                // eq.
                                if (lineTextToCursor.slice(-3) === "eq.") {
                                    for (let m of this.methods) {
                                        if (m.class === "eq") {
                                            completionItems.push(m);
                                        }
                                    }
                                }
                            }
                        }

                        return completionItems;
                    },
                },
                ":", "."
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

        // console.log("Completion prefixes are", prefixes);

        return prefixes;
    }
}
