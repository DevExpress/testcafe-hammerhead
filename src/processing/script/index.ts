// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
/*eslint-disable no-unused-vars*/
import { Program, Node } from 'estree';
import transform, { CodeChange, beforeTransform, afterTransform } from './transform';
/*eslint-enable no-unused-vars*/
import INSTRUCTION from './instruction';
import { add as addHeader, remove as removeHeader } from './header';
import { parse } from 'acorn-hammerhead';
import { generate, Syntax } from 'esotope-hammerhead';
import reEscape from '../../utils/regexp-escape';
import getBOM from '../../utils/get-bom';

const HTML_COMMENT_RE: RegExp       = /(^|\n)\s*<!--[^\n]*(\n|$)/g;
const OBJECT_RE: RegExp             = /^\s*\{.*\}\s*$/;
const TRAILING_SEMICOLON_RE: RegExp = /;\s*$/;
const OBJECT_WRAPPER_RE: RegExp     = /^\s*\((.*)\);\s*$/;
const SOURCEMAP_RE: RegExp          = /(?:\/\/[@#][ \t]+sourceMappingURL=([^\s'"]+?)[ \t]*$)/gm;
const PROCESSED_SCRIPT_RE: RegExp   = new RegExp([
    reEscape(INSTRUCTION.getLocation),
    reEscape(INSTRUCTION.setLocation),
    reEscape(INSTRUCTION.getProperty),
    reEscape(INSTRUCTION.setProperty),
    reEscape(INSTRUCTION.callMethod),
    reEscape(INSTRUCTION.processScript),
    reEscape(INSTRUCTION.processHtml),
    reEscape(INSTRUCTION.getPostMessage)
].join('|'));

// Code pre/post-processing
function removeHtmlComments (code: string): string {
    // NOTE: The JS parser removes the line that follows'<!--'. (T226589)
    do
        code = code.replace(HTML_COMMENT_RE, '\n');
    while (HTML_COMMENT_RE.test(code));

    return code;
}

function preprocess (code: string): { bom: string, preprocessed: string } {
    const bom        = getBOM(code);
    let preprocessed = bom ? code.substring(bom.length) : code;

    preprocessed = removeHeader(preprocessed);
    preprocessed = removeSourceMap(preprocessed);

    return { bom, preprocessed };
}

function removeSourceMap (code: string): string {
    return code.replace(SOURCEMAP_RE, '');
}

function postprocess (processed: string, withHeader: boolean, bom: string, strictMode: boolean): string {
    // NOTE: If the 'use strict' directive is not in the beginning of the file, it is ignored.
    // As we insert our header in the beginning of the script, we must put a new 'use strict'
    // before the header, otherwise it will be ignored.
    if (withHeader)
        processed = addHeader(processed, strictMode);

    return bom ? bom + processed : processed;
}


// Parse/generate code
function removeTrailingSemicolon (processed: string, src: string): string {
    return TRAILING_SEMICOLON_RE.test(src) ? processed : processed.replace(TRAILING_SEMICOLON_RE, '');
}

function getAst (src: string, isObject: boolean): Program {
    // NOTE: In case of objects (e.g.eval('{ 1: 2}')) without wrapping
    // object will be parsed as label. To avoid this we parenthesize src
    src = isObject ? `(${src})` : src;

    try {
        return parse(src, {
            allowReturnOutsideFunction:  true,
            allowImportExportEverywhere: true,
            ecmaVersion:                 11
        });
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
            compact:    true
        }
    });

    return src ? removeTrailingSemicolon(code, src) : code;
}


// Analyze code
function analyze (code: string): { ast: Program, isObject: boolean } {
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

function applyChanges (script: string, changes: Array<CodeChange>, isObject: boolean): string {
    const indexOffset = isObject ? -1 : 0;
    const chunks      = [];
    let index         = 0;

    if (!changes.length)
        return script;

    changes.sort((a, b) => a.start - b.start);

    for (const change of changes) {
        const changeStart     = change.start + indexOffset;
        const changeEnd       = change.end + indexOffset;
        let replacement: Node = change.parent[change.key];

        replacement = change.index !== -1 ? replacement[change.index] : replacement;
        chunks.push(script.substring(index, changeStart));
        chunks.push(' ');
        chunks.push(getCode(replacement, script.substring(changeStart, changeEnd)));
        index += changeEnd - index;
    }

    chunks.push(script.substring(index));

    return chunks.join('');
}

export function isScriptProcessed (code: string): boolean {
    return PROCESSED_SCRIPT_RE.test(code);
}

export function processScript (src: string, withHeader: boolean = false, wrapLastExprWithProcessHtml: boolean = false, resolver?: Function): string {
    const { bom, preprocessed } = preprocess(src);
    const withoutHtmlComments   = removeHtmlComments(preprocessed);
    const { ast, isObject }     = analyze(withoutHtmlComments);

    if (!ast)
        return src;

    withHeader = withHeader && !isObject && !isArrayDataScript(ast);

    beforeTransform(wrapLastExprWithProcessHtml, resolver);

    const changes = transform(ast);

    afterTransform();

    let processed = changes.length ? applyChanges(withoutHtmlComments, changes, isObject) : preprocessed;

    processed = postprocess(processed, withHeader, bom, isStrictMode(ast));

    if (isObject)
        processed = processed.replace(OBJECT_WRAPPER_RE, '$1');

    return processed;
}
