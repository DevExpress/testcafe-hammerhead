// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import reEscape from '../../utils/regexp-escape';
import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import INSTRUCTION from './instruction';

export const SCRIPT_PROCESSING_START_COMMENT      = '/*hammerhead|script|start*/';
export const SCRIPT_PROCESSING_END_COMMENT        = '/*hammerhead|script|end*/';
export const SCRIPT_PROCESSING_END_HEADER_COMMENT = '/*hammerhead|script|processing-header-end*/';

const STRICT_MODE_PLACEHOLDER = '{strict-placeholder}';

const HEADER = [
    SCRIPT_PROCESSING_START_COMMENT,
    STRICT_MODE_PLACEHOLDER,
    'if(typeof window!=="undefined"&&window){',
    `window["${INTERNAL_PROPS.processDomMethodName}"] && window["${INTERNAL_PROPS.processDomMethodName}"]();`,
    '}',
    'else{',
    `var ${ INSTRUCTION.getLocation }=function(l){return l},`,
    `${ INSTRUCTION.setLocation }=function(l,v){return l = v},`,
    `${ INSTRUCTION.setProperty }=function(o,p,v){return o[p] = v},`,
    `${ INSTRUCTION.getProperty }=function(o,p){return o[p]},`,
    `${ INSTRUCTION.callMethod }=function(o,p,a){return o[p].apply(o,a)},`,
    `${ INSTRUCTION.getEval }=function(e){return e},`,
    `${ INSTRUCTION.processScript }=function(s){return s},`,
    `${ INSTRUCTION.processHtml }=function(h){return h},`,
    `${ INSTRUCTION.getPostMessage }=function(w,p){return arguments.length===1?w.postMessage:p};`,
    '}',
    SCRIPT_PROCESSING_END_HEADER_COMMENT,
    '\n'
].join('');

// NOTE: IE removes trailing newlines in script.textContent,
// so a trailing newline in RegExp is optional
const HEADER_RE                 = new RegExp(`${reEscape(SCRIPT_PROCESSING_START_COMMENT)}[\\S\\s]+?${reEscape(SCRIPT_PROCESSING_END_HEADER_COMMENT)}\n?`, 'gi');
const PROCESSING_END_COMMENT_RE = new RegExp(`\n?${ reEscape(SCRIPT_PROCESSING_END_COMMENT) }\\s*`, 'gi');

export function remove (code) {
    return code
        .replace(HEADER_RE, '')
        .replace(PROCESSING_END_COMMENT_RE, '');
}

export function add (code, isStrictMode) {
    const header = HEADER.replace(STRICT_MODE_PLACEHOLDER, isStrictMode ? '"use strict";' : '');

    return header + code + '\n' + SCRIPT_PROCESSING_END_COMMENT;
}
