// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
import { Program, Node } from 'estree';
import transform, { CodeChange } from './transform';
import INSTRUCTION from './instruction';
import { add as addHeader, remove as removeHeader } from './header';
import { parse } from 'acorn-hammerhead';
import { generate, Syntax } from 'esotope-hammerhead';
import reEscape from '../../utils/regexp-escape';
import { getBOM } from '../../utils/get-bom';

const HTML_COMMENT_RE       = /(^|\n)\s*<!--[^\n]*(\n|$)/g;
const OBJECT_RE             = /^\s*\{.*\}\s*$/;
const TRAILING_SEMICOLON_RE = /;\s*$/;
const OBJECT_WRAPPER_RE     = /^\s*\((.*)\);\s*$/;
const SOURCEMAP_RE          = /(?:\/\/[@#][ \t]+sourceMappingURL=([^\s'"]+?)[ \t]*$)/gm;

const PROCESSED_SCRIPT_RE = new RegExp([
    reEscape(INSTRUCTION.getLocation),
    reEscape(INSTRUCTION.setLocation),
    reEscape(INSTRUCTION.getProperty),
    reEscape(INSTRUCTION.setProperty),
    reEscape(INSTRUCTION.callMethod),
    reEscape(INSTRUCTION.processScript),
    reEscape(INSTRUCTION.processHtml),
    reEscape(INSTRUCTION.getPostMessage),
    reEscape(INSTRUCTION.getProxyUrl),
].join('|'));
const PARSING_OPTIONS               = {
    allowReturnOutsideFunction:  true,
    allowImportExportEverywhere: true,
    ecmaVersion:                 13,
};

// Code pre/post-processing
function removeHtmlComments (code: string): string {
    // NOTE: The JS parser removes the line that follows'<!--'. (T226589)
    do
        code = code.replace(HTML_COMMENT_RE, '\n');
    while (HTML_COMMENT_RE.test(code));

    return code;
}

function preprocess (code: string): { bom: string | null; preprocessed: string } {
    const bom        = getBOM(code);
    let preprocessed = bom ? code.substring(bom.length) : code;

    preprocessed = removeHeader(preprocessed);
    preprocessed = removeSourceMap(preprocessed);

    return { bom, preprocessed };
}

function removeSourceMap (code: string): string {
    return code.replace(SOURCEMAP_RE, '');
}

function postprocess (processed: string, withHeader: boolean, bom: string | null, strictMode: boolean, swScopeHeaderValue?: string, nativeAutomation?: boolean, workerSettings?: any): string {
    // NOTE: If the 'use strict' directive is not in the beginning of the file, it is ignored.
    // As we insert our header in the beginning of the script, we must put a new 'use strict'
    // before the header, otherwise it will be ignored.
    if (withHeader)
        processed = addHeader(processed, strictMode, swScopeHeaderValue, nativeAutomation, workerSettings);

    return bom ? bom + processed : processed;
}


// Parse/generate code
function removeTrailingSemicolon (processed: string, src: string): string {
    return TRAILING_SEMICOLON_RE.test(src) ? processed : processed.replace(TRAILING_SEMICOLON_RE, '');
}

function getAst (src: string, isObject: boolean): Program | null {
    // NOTE: In case of objects (e.g.eval('{ 1: 2}')) without wrapping
    // object will be parsed as label. To avoid this we parenthesize src
    src = isObject ? `(${src})` : src;

    try {
        return parse(src, PARSING_OPTIONS);
    }
    catch (err) {
        return null;
    }
}

function getCode (ast: Node, src: string): string {
    const code = generate(ast, {
        format: {
            quotes:     'double',
            escapeless: true,
            compact:    true,
        },
    });

    return src ? removeTrailingSemicolon(code, src) : code;
}


// Analyze code
function analyze (code: string): { ast: Program | null; isObject: boolean } {
    let isObject = OBJECT_RE.test(code);
    let ast      = getAst(code, isObject);

    // NOTE: `{ const a = 'foo'; }` edge case
    if (!ast && isObject) {
        ast      = getAst(code, false);
        isObject = false;
    }

    return { ast, isObject };
}

function isArrayDataScript (ast: Program): boolean {
    const firstChild = ast.body[0];

    return ast.body.length === 1 &&
           firstChild.type === Syntax.ExpressionStatement &&
           firstChild.expression.type === Syntax.ArrayExpression;
}

function isStrictMode (ast: Program): boolean {
    if (ast.body.length) {
        const firstChild = ast.body[0];

        if (firstChild.type === Syntax.ExpressionStatement && firstChild.expression.type === Syntax.Literal)
            return firstChild.expression.value === 'use strict';
    }

    return false;
}

function applyChanges (script: string, changes: CodeChange[], isObject: boolean): string {
    const indexOffset = isObject ? -1 : 0;
    const chunks      = [] as string[];
    let index         = 0;

    if (!changes.length)
        return script;

    changes.sort((a, b) => (a.start - b.start) || (a.end - b.end) || // eslint-disable-line @typescript-eslint/no-extra-parens
        ((a.node.type === Syntax.VariableDeclaration ? 0 : 1) - (b.node.type === Syntax.VariableDeclaration ? 0 : 1))); // eslint-disable-line @typescript-eslint/no-extra-parens

    for (const change of changes) {
        const changeStart = change.start + indexOffset;
        const changeEnd   = change.end + indexOffset;
        const parentheses = change.node.type === Syntax.SequenceExpression &&
            change.parentType !== Syntax.ExpressionStatement &&
            change.parentType !== Syntax.SequenceExpression;

        chunks.push(script.substring(index, changeStart));
        chunks.push(parentheses ? '(' : ' ');
        chunks.push(getCode(change.node, script.substring(changeStart, changeEnd)));
        chunks.push(parentheses ? ')' : ' ');
        index += changeEnd - index;
    }

    chunks.push(script.substring(index));

    return chunks.join('');
}

export function isScriptProcessed (code: string): boolean {
    return PROCESSED_SCRIPT_RE.test(code);
}

export function processScript (src: string, withHeader = false, wrapLastExprWithProcessHtml = false, resolver?: Function, swScopeHeaderValue?: string, nativeAutomation?: boolean, workerSettings?: any): string {
    const { bom, preprocessed } = preprocess(src);
    const withoutHtmlComments   = removeHtmlComments(preprocessed);
    const { ast, isObject }     = analyze(withoutHtmlComments);

    if (!ast)
        return src;

    withHeader = withHeader && !isObject && !isArrayDataScript(ast);

    const changes = nativeAutomation ? [] : transform(ast, wrapLastExprWithProcessHtml, resolver);

    let processed = changes.length ? applyChanges(withoutHtmlComments, changes, isObject) : preprocessed;

    processed = postprocess(processed, withHeader, bom, isStrictMode(ast), swScopeHeaderValue, nativeAutomation, workerSettings);

    if (isObject)
        processed = processed.replace(OBJECT_WRAPPER_RE, '$1');

    return processed;
}
