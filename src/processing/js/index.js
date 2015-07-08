import { parse, generate } from './parsing-tools';
import modifiers from './modifiers';
import * as instructs from './instructions';

// Const
const HTML_COMMENT_REG_EXP = /(^|\n)\s*<!--[.\r]*(\n|$)/g;

const codegenOpts = {
    format: {
        quotes:     'double',
        escapeless: true
    }
};

const MOCK_ACCESSORS = [
    'var __w$undef_ = typeof window === "undefined",\r\n',
    instructs.GET_LOCATION_METH_NAME, '=__w$undef_?function(l){return l}:window.', instructs.GET_LOCATION_METH_NAME, ',\r\n',
    instructs.SET_LOCATION_METH_NAME, '=__w$undef_?function(l,v){return l = v}:window.', instructs.SET_LOCATION_METH_NAME, ',\r\n',
    instructs.SET_PROPERTY_METH_NAME, '=__w$undef_?function(o,p,v){return o[p] = v}:window.', instructs.SET_PROPERTY_METH_NAME, ',\r\n',
    instructs.GET_PROPERTY_METH_NAME, '=__w$undef_?function(o,p){return o[p]}:window.', instructs.GET_PROPERTY_METH_NAME, ',\r\n',
    instructs.CALL_METHOD_METH_NAME, '=__w$undef_?function(o,p,a){return o[p].apply(o,a)}:window.', instructs.CALL_METHOD_METH_NAME, ',\r\n',
    instructs.PROCESS_SCRIPT_METH_NAME, '=__w$undef_?function(s){return s}:window.', instructs.PROCESS_SCRIPT_METH_NAME, ';\r\n'
].join('');

class JsProcessor {
    constructor () {
        this.GET_LOCATION_METH_NAME     = instructs.GET_LOCATION_METH_NAME;
        this.SET_LOCATION_METH_NAME     = instructs.SET_LOCATION_METH_NAME;
        this.SET_PROPERTY_METH_NAME     = instructs.SET_PROPERTY_METH_NAME;
        this.GET_PROPERTY_METH_NAME     = instructs.GET_PROPERTY_METH_NAME;
        this.CALL_METHOD_METH_NAME      = instructs.CALL_METHOD_METH_NAME;
        this.PROCESS_SCRIPT_METH_NAME   = instructs.PROCESS_SCRIPT_METH_NAME;
        this.DOCUMENT_WRITE_BEGIN_PARAM = instructs.DOCUMENT_WRITE_BEGIN_PARAM;
        this.DOCUMENT_WRITE_END_PARAM   = instructs.DOCUMENT_WRITE_END_PARAM;

        this.MOCK_ACCESSORS = MOCK_ACCESSORS;

        this.wrappedProperties = instructs.wrappedProperties;
        this.wrappedMethods    = instructs.wrappedMethods;
    }

    _htmlCommentsReplacer (code) {
        code = code.replace(HTML_COMMENT_REG_EXP, '\n');

        if (HTML_COMMENT_REG_EXP.test(code))
            code = this._htmlCommentsReplacer(code);

        return code;
    }

    _modify (ast, parent, key) {
        var modified = false;

        if (!ast || typeof ast !== 'object')
            return modified;

        if (ast.type) {
            for (var i = 0; i < modifiers.length; i++) {
                if (modifiers[i].condition(ast, parent)) {
                    var needToModify = modifiers[i].modifier(ast, parent, key);

                    modified = true;

                    if (needToModify)
                        modified = this._modify(parent[key], parent, key) || modified;
                }
            }
        }

        for (var astKey in ast) {
            if (ast.hasOwnProperty(astKey)) {
                var childNode = ast[astKey];

                /*eslint-disable indent*/
                if (Object.prototype.toString.call(childNode) === '[object Array]') {
                    for (var j = 0; j < childNode.length; j++)
                        modified = this._modify(childNode[j], ast, astKey) || modified;
                }
                else
                    modified = this._modify(childNode, ast, astKey) || modified;
                /*eslint-enable indent*/
            }
        }

        return modified;
    }

    _isArray (code) {
        return /^\s*\[[\s\S]*\]\s*$/.test(code);
    }

    _isObject (code) {
        return /^\s*\{[\s\S]*\}\s*$/.test(code);
    }

    isJSON (code) {
        if (this._isObject(code)) {
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

    isScriptProcessed (code) {
        return new RegExp([
            instructs.GET_LOCATION_METH_NAME,
            instructs.SET_LOCATION_METH_NAME,
            instructs.SET_PROPERTY_METH_NAME,
            instructs.GET_PROPERTY_METH_NAME,
            instructs.CALL_METHOD_METH_NAME,
            instructs.PROCESS_SCRIPT_METH_NAME
        ].join('|').replace(/\$/, '\\$')).test(code);
    }

    isDataScript (code) {
        return this._isObject(code) || this._isArray(code);
    }

    process (code, beautify) {
        var isJSON   = this.isJSON(code);
        var isObject = this._isObject(code);

        codegenOpts.json = isJSON;

        // T226589. Js parser removes next line after '<!--'
        var result = this._htmlCommentsReplacer(code);
        var ast    = null;

        try {
            ast = parse(isObject && !isJSON ? '(' + result + ')' : 'function temp(){\n' + result +
                                                                   '\n}');
        }
        catch (e) {
            try {
                /*eslint-disable indent*/
                if (isObject && !isJSON) {
                    ast      = parse('function temp(){\n' + result + '\n}');
                    isObject = false;
                }
                else
                    return code;
                /*eslint-enable indent*/
            }
            catch (err) {
                return code;
            }
        }

        var modified = this._modify(ast);

        if (!modified)
            return code;

        codegenOpts.format.compact = !beautify;

        result = generate(ast, codegenOpts);

        if (isObject && !isJSON)
            result = result.replace(/^\(|\);\s*$/g, '');
        else
            result = result.replace(/^\s*function\s+temp\s*\(\s*\)\s*{\s*/, '').replace(/\s*}\s*$/, '');

        if (!/;\s*$/.test(code))
            result = result.replace(/;\s*$/, '');

        return result;
    }
}

export default new JsProcessor();
