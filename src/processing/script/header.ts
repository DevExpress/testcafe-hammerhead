// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import reEscape from '../../utils/regexp-escape';
import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import INSTRUCTION from './instruction';
import SERVICE_ROUTES from '../../proxy/service-routes';
import { stringify as stringifyJSON } from '../../utils/json';

export const SCRIPT_PROCESSING_START_COMMENT      = '/*hammerhead|script|start*/';
export const SCRIPT_PROCESSING_END_COMMENT        = '/*hammerhead|script|end*/';
export const SCRIPT_PROCESSING_END_HEADER_COMMENT = '/*hammerhead|script|processing-header-end*/';

const STRICT_MODE_PLACEHOLDER     = '{strict-placeholder}';
const SW_SCOPE_HEADER_VALUE       = '{sw-scope-header-value}';
const WORKER_SETTINGS_PLACEHOLDER = '{worker-settings}';

const IMPORT_WORKER_HAMMERHEAD = `
if (typeof importScripts !== "undefined" && /\\[native code]/g.test(importScripts.toString())) {
    var ${INSTRUCTION.getWorkerSettings} = function () {return ${WORKER_SETTINGS_PLACEHOLDER}};
    importScripts((location.origin || (location.protocol + "//" + location.host)) + "${SERVICE_ROUTES.workerHammerhead}");
}
`;

const PROCESS_DOM_METHOD = `window['${INTERNAL_PROPS.processDomMethodName}'] && window['${INTERNAL_PROPS.processDomMethodName}']();`;

function trim (val: string): string {
    return val.replace(/\n(?!$)\s*/g, '');
}

const NATIVE_AUTOMATION_HEADER = trim(`
    ${SCRIPT_PROCESSING_START_COMMENT}
    ${STRICT_MODE_PLACEHOLDER}

    if (typeof window !== 'undefined' && window) {
        ${PROCESS_DOM_METHOD}
    }

    ${SCRIPT_PROCESSING_END_HEADER_COMMENT}
`);

const HEADER = trim(`
    ${SCRIPT_PROCESSING_START_COMMENT}
    ${STRICT_MODE_PLACEHOLDER}
    ${SW_SCOPE_HEADER_VALUE}

    if (typeof window !== 'undefined' && window){
        ${PROCESS_DOM_METHOD}

        if (window.${INSTRUCTION.getProperty} && typeof ${INSTRUCTION.getProperty} === 'undefined')
            var ${INSTRUCTION.getLocation} = window.${INSTRUCTION.getLocation},
                ${INSTRUCTION.setLocation} = window.${INSTRUCTION.setLocation},
                ${INSTRUCTION.setProperty} = window.${INSTRUCTION.setProperty},
                ${INSTRUCTION.getProperty} = window.${INSTRUCTION.getProperty},
                ${INSTRUCTION.callMethod} = window.${INSTRUCTION.callMethod},
                ${INSTRUCTION.getEval} = window.${INSTRUCTION.getEval},
                ${INSTRUCTION.processScript} = window.${INSTRUCTION.processScript},
                ${INSTRUCTION.processHtml} = window.${INSTRUCTION.processHtml},
                ${INSTRUCTION.getPostMessage} = window.${INSTRUCTION.getPostMessage},
                ${INSTRUCTION.getProxyUrl} = window.${INSTRUCTION.getProxyUrl},
                ${INSTRUCTION.restArray} = window.${INSTRUCTION.restArray},
                ${INSTRUCTION.restObject} = window.${INSTRUCTION.restObject},
                ${INSTRUCTION.arrayFrom} = window.${INSTRUCTION.arrayFrom};
    } else {
        if (typeof ${INSTRUCTION.getProperty} === 'undefined')
            var ${INSTRUCTION.getLocation} = function(l){return l},
                ${INSTRUCTION.setLocation} = function(l,v){return l = v},
                ${INSTRUCTION.setProperty} = function(o,p,v){return o[p] = v},
                ${INSTRUCTION.getProperty} = function(o,p){return o[p]},
                ${INSTRUCTION.callMethod} = function(o,p,a){return o[p].apply(o,a)},
                ${INSTRUCTION.getEval} = function(e){return e},
                ${INSTRUCTION.processScript} = function(s){return s},
                ${INSTRUCTION.processHtml} = function(h){return h},
                ${INSTRUCTION.getPostMessage} = function(w,p){return arguments.length===1?w.postMessage:p},
                ${INSTRUCTION.getProxyUrl} = function(u,d){return u},
                ${INSTRUCTION.restArray} = function(a,i){return Array.prototype.slice.call(a, i)},
                ${INSTRUCTION.restObject} = function(o,p){var k=Object.keys(o),n={};for(var i=0;i<k.length;++i)if(p.indexOf(k[i])<0)n[k[i]]=o[k[i]];return n},
                ${INSTRUCTION.arrayFrom} = function(r){if(!r)return r;return!Array.isArray(r)&&"function"==typeof r[Symbol.iterator]?Array.from(r):r};

        ${IMPORT_WORKER_HAMMERHEAD}
    }
    ${SCRIPT_PROCESSING_END_HEADER_COMMENT}
`);

const HEADER_RE                 = new RegExp(`${reEscape(SCRIPT_PROCESSING_START_COMMENT)}[\\S\\s]+?${reEscape(SCRIPT_PROCESSING_END_HEADER_COMMENT)}\n?`, 'gi');
const PROCESSING_END_COMMENT_RE = new RegExp(`\n?${ reEscape(SCRIPT_PROCESSING_END_COMMENT) }\\s*`, 'gi');

export function remove (code: string): string {
    return code
        .replace(HEADER_RE, '')
        .replace(PROCESSING_END_COMMENT_RE, '');
}

export function add (code: string, isStrictMode: boolean, swScopeHeaderValue?: string, nativeAutomation?: boolean, workerSettings?: any): string {
    const targetHeader = nativeAutomation ? NATIVE_AUTOMATION_HEADER : HEADER;

    const header = targetHeader
        .replace(STRICT_MODE_PLACEHOLDER, isStrictMode ? '"use strict";' : '')
        .replace(SW_SCOPE_HEADER_VALUE, swScopeHeaderValue ? `var ${INSTRUCTION.swScopeHeaderValue} = ${stringifyJSON(swScopeHeaderValue)};` : '')
        .replace(WORKER_SETTINGS_PLACEHOLDER, workerSettings ? JSON.stringify(workerSettings) : 'null');

    return header + code + '\n' + SCRIPT_PROCESSING_END_COMMENT;
}
