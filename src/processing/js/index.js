// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import transform from './transform';
import INSTRUCTION from './instruction';
import { parse, generate } from './parsing-tools';

// Const
const HTML_COMMENT_RE = /(^|\n)\s*<!--[.\r]*(\n|$)/g;
const ARRAY_RE        = /^\s*\[[\s\S]*\]\s*$/;
const OBJECT_RE       = /^\s*\{[\s\S]*\}\s*$/;

const PROCESSED_SCRIPT_RE = new RegExp([
    INSTRUCTION.getLocation,
    INSTRUCTION.setLocation,
    INSTRUCTION.getProperty,
    INSTRUCTION.setProperty,
    INSTRUCTION.callMethod,
    INSTRUCTION.processScript
].join('|').replace(/\$/, '\\$'));


// Utils
function replaceHtmlComments (code) {
    do
        code = code.replace(HTML_COMMENT_RE, '\n');
    while (HTML_COMMENT_RE.test(code));

    return code;
}

function isArrayCode (code) {
    return ARRAY_RE.test(code);
}

function isObjectCode (code) {
    return OBJECT_RE.test(code);
}

function isJSONCode (code) {
    if (isObjectCode(code)) {
        try {
            JSON.parse(code);

            return true;
        }
        catch (e) {
            return false;
        }
    }

    return false;
}


export default {
    isScriptProcessed (code) {
        return PROCESSED_SCRIPT_RE.test(code);
    },

    isDataScript (code) {
        return isObjectCode(code) || isArrayCode(code);
    },

    process (code, beautify) {
        var isJSON   = isJSONCode(code);
        var isObject = isObjectCode(code);

        // NOTE: The JS parser removes the line that follows'<!--'. (T226589)
        var result = replaceHtmlComments(code);
        var ast    = null;

        try {
            ast = parse(isObject && !isJSON ? '(' + result + ')' : 'function temp(){\n' + result +
                                                                   '\n}');
        }
        catch (e) {
            try {
                if (isObject && !isJSON) {
                    ast      = parse('function temp(){\n' + result + '\n}');
                    isObject = false;
                }
                else
                    return code;
            }
            catch (err) {
                return code;
            }
        }

        if (!transform(ast))
            return code;

        result = generate(ast, {
            format: {
                quotes:     'double',
                escapeless: true,
                compact:    !beautify
            },

            json: isJSON
        });

        if (isObject && !isJSON)
            result = result.replace(/^\(|\);\s*$/g, '');
        else
            result = result.replace(/^\s*function\s+temp\s*\(\s*\)\s*{\s*/, '').replace(/\s*}\s*$/, '');

        if (!/;\s*$/.test(code))
            result = result.replace(/;\s*$/, '');

        return result;
    }
};
