// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import transform from './transform';
import INSTRUCTION from './instruction';
import { add as addHeader, remove as removeHeader } from './header';
import { parse } from './tools/acorn';
import { generate, Syntax } from './tools/esotope';
import reEscape from '../../utils/regexp-escape';
import getBOM from '../../utils/get-bom';


// Const
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
    reEscape(INSTRUCTION.getStorage),
    reEscape(INSTRUCTION.getPostMessage)
].join('|'));


// Code pre/post-processing
function removeHtmlComments (code) {
    // NOTE: The JS parser removes the line that follows'<!--'. (T226589)
    do
        code = code.replace(HTML_COMMENT_RE, '\n');
    while (HTML_COMMENT_RE.test(code));

    return code;
}

function preprocess (code) {
    var bom          = getBOM(code);
    var preprocessed = bom ? code.substring(bom.length) : code;

    preprocessed = removeHeader(preprocessed);
    preprocessed = removeSourceMapIfNecessary(preprocessed);

    return { bom, preprocessed };
}

function removeSourceMapIfNecessary (code) {
    return SOURCEMAP_RE.test(code) ? code.replace(SOURCEMAP_RE, '') : code;
}

function postprocess (processed, withHeader, bom, strictMode) {
    // NOTE: If the 'use strict' directive is not in the beginning of the file, it is ignored.
    // As we insert our header in the beginning of the script, we must put a new 'use strict'
    // before the header, otherwise it will be ignored.
    if (withHeader)
        processed = addHeader(processed, strictMode);

    return bom ? bom + processed : processed;
}


// Parse/generate code
function removeTrailingSemicolonIfNecessary (processed, src) {
    return TRAILING_SEMICOLON_RE.test(src) ? processed : processed.replace(TRAILING_SEMICOLON_RE, '');
}

function getAst (src, isObject) {
    // NOTE: In case of objects (e.g.eval('{ 1: 2}')) without wrapping
    // object will be parsed as label. To avoid this we parenthesize src
    src = isObject ? `(${src})` : src;

    try {
        return parse(src, { allowReturnOutsideFunction: true });
    }
    catch (err) {
        return null;
    }
}

function getCode (ast, src) {
    var code = generate(ast, {
        format: {
            quotes:     'double',
            escapeless: true,
            compact:    true
        }
    });

    return src ? removeTrailingSemicolonIfNecessary(code, src) : code;
}


// Analyze code
function analyze (code) {
    var isObject = OBJECT_RE.test(code);
    var ast      = getAst(code, isObject);

    // NOTE: `{ var a = 'foo'; }` edge case
    if (!ast && isObject) {
        ast      = getAst(code, false);
        isObject = false;
    }

    return { ast, isObject };
}

function isArrayDataScript (ast) {
    return ast.body.length === 1 &&
           ast.body[0].type === Syntax.ExpressionStatement &&
           ast.body[0].expression.type === Syntax.ArrayExpression;
}

function isStrictMode (ast) {
    if (ast.body.length) {
        var firstChild = ast.body[0];

        if (firstChild.type === Syntax.ExpressionStatement && firstChild.expression.type === Syntax.Literal)
            return firstChild.expression.value === 'use strict';
    }

    return false;
}

function applyChanges (script, changes, isObject) {
    var indexOffset = isObject ? -1 : 0;
    var chunks      = [];
    var index       = 0;

    if (!changes.length)
        return script;

    changes.sort((a, b) => a.start - b.start);

    for (var i = 0; i < changes.length; i++) {
        var change      = changes[i];
        var changeStart = change.start + indexOffset;
        var changeEnd   = change.end + indexOffset;
        var replacement = change.parent[change.key];

        replacement = change.index !== -1 ? replacement[change.index] : replacement;
        chunks.push(script.substring(index, changeStart));
        chunks.push(' ');
        chunks.push(getCode(replacement, script.substring(changeStart, changeEnd)));
        index += changeEnd - index;
    }

    chunks.push(script.substring(index));

    return chunks.join('');
}

export function isScriptProcessed (code) {
    return PROCESSED_SCRIPT_RE.test(code);
}

export function processScript (src, withHeader) {
    var { bom, preprocessed } = preprocess(src);
    var withoutHtmlComments   = removeHtmlComments(preprocessed);
    var { ast, isObject }     = analyze(withoutHtmlComments);

    if (!ast)
        return src;

    withHeader = withHeader && !isObject && !isArrayDataScript(ast);

    var changes   = transform(ast);
    var processed = changes.length ? applyChanges(withoutHtmlComments, changes, isObject) : preprocessed;

    processed = postprocess(processed, withHeader, bom, isStrictMode(ast));

    if (isObject)
        processed = processed.replace(OBJECT_WRAPPER_RE, '$1');

    return processed;
}
