// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import INTERNAL_PROPS from '../processing/dom/internal-properties';
import dedent from 'dedent';
import jsProcessor from './js';
import INSTRUCTION from './js/instruction';

// Byte Order Mark
const BOM_REGEX = new RegExp(
    '^(\\xEF\\xBB\\xBF|' +
    '\\xFE\\xFF|' +
    '\\xFF\\xFE|' +
    '\\x00\\x00\\xFE\\xFF|' +
    '\\xFF\\xFE\\x00\\x00|' +
    '\\x2B\\x2F\\x76\\x38|' +
    '\\x2B\\x2F\\x76\\x39|' +
    '\\x2B\\x2F\\x76\\x2B|' +
    '\\x2B\\x2F\\x76\\x2F|' +
    '\\xF7\\x64\\x4C|' +
    '\\xDD\\x73\\x66\\x73|' +
    '\\x0E\\xFE\\xFF|' +
    '\\xFB\\xEE\\x28|' +
    '\\x84\\x31\\x95\\x33)'
);

class ScriptProcessor {
    constructor () {
        var HEADER_PREFIX    = '/*hammerhead|script-processing-header|start*/';
        var HEADER_POSTFIX   = '/*hammerhead|script-processing-header|end*/';

        this.SCRIPT_HEADER = dedent`
            ${HEADER_PREFIX}
            var __w$= typeof window!=="undefined"&&window;
            __w$ && __w$["${INTERNAL_PROPS.overrideDomMethodName}"] && __w$["${INTERNAL_PROPS.overrideDomMethodName}"]();
            var ${ INSTRUCTION.getLocation }=__w$?__w$.${ INSTRUCTION.getLocation }:function(l){return l},
                ${ INSTRUCTION.setLocation }=__w$?__w$.${ INSTRUCTION.setLocation }:function(l,v){return l = v},
                ${ INSTRUCTION.setProperty }=__w$?__w$.${ INSTRUCTION.setProperty }:function(o,p,v){return o[p] = v},
                ${ INSTRUCTION.getProperty }=__w$?__w$.${ INSTRUCTION.getProperty }:function(o,p){return o[p]},
                ${ INSTRUCTION.callMethod }=__w$?__w$.${ INSTRUCTION.callMethod }:function(o,p,a){return o[p].apply(o,a)},
                ${ INSTRUCTION.processScript }=__w$?__w$.${ INSTRUCTION.processScript }:function(s){return s};
            ${HEADER_POSTFIX}
        `;

        this.SCRIPT_HEADER_REG_EX = new RegExp(`${HEADER_PREFIX}[\\S\\s]+?${HEADER_POSTFIX}`.replace(/\/|\*|\|/g, '\\$&'), 'i');
    }

    process (text, withoutHeader) {
        var bom = this.getBOM(text);

        if (bom)
            text = text.replace(bom, '');

        text = jsProcessor.process(text);

        // NOTE: Overriding methods that work with the DOM.
        if (!jsProcessor.isDataScript(text) && !withoutHeader &&
            text.indexOf(INTERNAL_PROPS.overrideDomMethodName) === -1)
            text = this.SCRIPT_HEADER + text;

        return bom ? bom + text : text;
    }

    cleanUpHeader (text) {
        return text.replace(this.SCRIPT_HEADER_REG_EX, '');
    }

    getBOM (text) {
        var match = text.match(BOM_REGEX);

        return match ? match[0] : null;
    }
}

export default new ScriptProcessor();
