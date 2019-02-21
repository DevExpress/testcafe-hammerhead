// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import reEscape from '../../utils/regexp-escape';
import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import INSTRUCTION from './instruction';

export const SCRIPT_PROCESSING_START_COMMENT: string      = '/*hammerhead|script|start*/';
export const SCRIPT_PROCESSING_END_COMMENT: string        = '/*hammerhead|script|end*/';
export const SCRIPT_PROCESSING_END_HEADER_COMMENT: string = '/*hammerhead|script|processing-header-end*/';

const STRICT_MODE_PLACEHOLDER: string = '{strict-placeholder}';

const HEADER: string = `
    ${SCRIPT_PROCESSING_START_COMMENT}
    ${STRICT_MODE_PLACEHOLDER}

    if (typeof window !== 'undefined' && window){
        window['${INTERNAL_PROPS.processDomMethodName}'] && window['${INTERNAL_PROPS.processDomMethodName}']();

        if (window.${INSTRUCTION.getProperty} && typeof ${INSTRUCTION.getProperty} === 'undefined') {
            var ${INSTRUCTION.getLocation} = window.${INSTRUCTION.getLocation},
                ${INSTRUCTION.setLocation} = window.${INSTRUCTION.setLocation},
                ${INSTRUCTION.setProperty} = window.${INSTRUCTION.setProperty},
                ${INSTRUCTION.getProperty} = window.${INSTRUCTION.getProperty},
                ${INSTRUCTION.callMethod} = window.${INSTRUCTION.callMethod},
                ${INSTRUCTION.getEval} = window.${INSTRUCTION.getEval},
                ${INSTRUCTION.processScript} = window.${INSTRUCTION.processScript},
                ${INSTRUCTION.processHtml} = window.${INSTRUCTION.processHtml},
                ${INSTRUCTION.getPostMessage} = window.${INSTRUCTION.getPostMessage};
        }
    } else {
        var ${INSTRUCTION.getLocation} = function(l){return l},
            ${INSTRUCTION.setLocation} = function(l,v){return l = v},
            ${INSTRUCTION.setProperty} = function(o,p,v){return o[p] = v},
            ${INSTRUCTION.getProperty} = function(o,p){return o[p]},
            ${INSTRUCTION.callMethod} = function(o,p,a){return o[p].apply(o,a)},
            ${INSTRUCTION.getEval} = function(e){return e},
            ${INSTRUCTION.processScript} = function(s){return s},
            ${INSTRUCTION.processHtml} = function(h){return h},
            ${INSTRUCTION.getPostMessage} = function(w,p){return arguments.length===1?w.postMessage:p};
    }
    ${SCRIPT_PROCESSING_END_HEADER_COMMENT}
`.replace(/\n(?!$)\s*/g, '');

// NOTE: IE removes trailing newlines in script.textContent,
// so a trailing newline in RegExp is optional
const HEADER_RE: RegExp                 = new RegExp(`${reEscape(SCRIPT_PROCESSING_START_COMMENT)}[\\S\\s]+?${reEscape(SCRIPT_PROCESSING_END_HEADER_COMMENT)}\n?`, 'gi');
const PROCESSING_END_COMMENT_RE: RegExp = new RegExp(`\n?${ reEscape(SCRIPT_PROCESSING_END_COMMENT) }\\s*`, 'gi');

export function remove (code: string) {
    return code
        .replace(HEADER_RE, '')
        .replace(PROCESSING_END_COMMENT_RE, '');
}

export function add (code: string, isStrictMode: boolean) {
    const header = HEADER.replace(STRICT_MODE_PLACEHOLDER, isStrictMode ? '"use strict";' : '');

    return header + code + '\n' + SCRIPT_PROCESSING_END_COMMENT;
}
