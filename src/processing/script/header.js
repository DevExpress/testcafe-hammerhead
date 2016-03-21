// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import reEscape from '../../utils/regexp-escape';
import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import INSTRUCTION from './instruction';

const PREFIX  = '/*hammerhead|script-processing-header|start*/';
const POSTFIX = '/*hammerhead|script-processing-header|end*/';

export const HEADER = [
    PREFIX,
    'var __w$= typeof window!=="undefined"&&window;',
    `__w$ && __w$["${INTERNAL_PROPS.processDomMethodName}"] && __w$["${INTERNAL_PROPS.processDomMethodName}"]();`,
    `var ${ INSTRUCTION.getLocation }=__w$?__w$.${ INSTRUCTION.getLocation }:function(l){return l},`,
    `${ INSTRUCTION.setLocation }=__w$?__w$.${ INSTRUCTION.setLocation }:function(l,v){return l = v},`,
    `${ INSTRUCTION.setProperty }=__w$?__w$.${ INSTRUCTION.setProperty }:function(o,p,v){return o[p] = v},`,
    `${ INSTRUCTION.getProperty }=__w$?__w$.${ INSTRUCTION.getProperty }:function(o,p){return o[p]},`,
    `${ INSTRUCTION.callMethod }=__w$?__w$.${ INSTRUCTION.callMethod }:function(o,p,a){return o[p].apply(o,a)},`,
    `${ INSTRUCTION.getEval }=__w$?__w$.${ INSTRUCTION.getEval }:function(e){return e},`,
    `${ INSTRUCTION.processScript }=__w$?__w$.${ INSTRUCTION.processScript }:function(s){return s};`,
    POSTFIX,
    '\n'
].join('');

// NOTE: IE removes trailing newlines in script.textContent,
// so a trailing newline in RegExp is optional
const HEADER_RE = new RegExp(`${reEscape(PREFIX)}[\\S\\s]+?${reEscape(POSTFIX)}\n?`, 'i');

export function remove (code) {
    return code.replace(HEADER_RE, '');
}
