import jsProcessor from './js';
import Const from '../const';

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
        this.OVERRIDE_DOM_METH_SCRIPT = 'window["' + Const.DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME + '"]';

        this.SCRIPT_HEADER = '\r\ntypeof window !== "undefined" && ' + this.OVERRIDE_DOM_METH_SCRIPT + ' && ' +
                             this.OVERRIDE_DOM_METH_SCRIPT + '();\r\n' + jsProcessor.MOCK_ACCESSORS;

        this.SCRIPT_HEADER_REG_EX = new RegExp('^\\s*typeof[^\\n]+' + Const.DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME +
                                               '[^\\n]+\\n[^\\n]+\\n[^\\n]+\\n[^\\n]+\\n[^\\n]+\\n[^\\n]+\\n[^\\n]+\\n[^\\n]+__proc\\$Script;', 'i');
    }

    process (text, withoutHeader) {
        var bom = this.getBOM(text);

        if (bom)
            text = text.replace(bom, '');

        text = jsProcessor.process(text);

        // Overriding methods that work with the DOM.
        if (!jsProcessor.isDataScript(text) && !withoutHeader &&
            text.indexOf(Const.DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME) === -1)
            text = this.SCRIPT_HEADER + text;

        return bom ? bom + text : text;
    }

    getBOM (text) {
        var match = text.match(BOM_REGEX);

        return match ? match[0] : null;
    }
}

export default new ScriptProcessor();
