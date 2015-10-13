// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import dedent from 'dedent';
import jsProcessor from './js';
import { DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME } from '../const';

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
        var overrideDomMethScript = `window["${DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME}"]`;
        var scriptHeaderPrefix    = '/*hammerhead|script-processing-header|start*/';
        var scriptHeaderPostfix   = '/*hammerhead|script-processing-header|end*/';

        this.SCRIPT_HEADER = dedent`
            ${scriptHeaderPrefix}
            typeof window !== "undefined" && ${overrideDomMethScript} && ${overrideDomMethScript}();
            ${jsProcessor.MOCK_ACCESSORS}
            ${scriptHeaderPostfix}
        `;

        this.SCRIPT_HEADER_REG_EX = new RegExp(`${scriptHeaderPrefix}[\\S\\s]+?${scriptHeaderPostfix}`.replace(/\/|\*|\|/g, '\\$&'), 'i');
    }

    process (text, withoutHeader) {
        var bom = this.getBOM(text);

        if (bom)
            text = text.replace(bom, '');

        text = jsProcessor.process(text);

        // Overriding methods that work with the DOM.
        if (!jsProcessor.isDataScript(text) && !withoutHeader &&
            text.indexOf(DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME) === -1)
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
