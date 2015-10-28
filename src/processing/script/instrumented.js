// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

// NOTE: constants are exported for the testing purposes
export const METHODS = [
    'querySelector',
    'querySelectorAll',
    'postMessage',
    'write',
    'writeln'
];

export const PROPERTIES = [
    'action',
    'activeElement',
    'attributes',
    'autocomplete',
    'background',
    'backgroundImage',
    'borderImage',
    'cookie',
    'cssText',
    'cursor',
    'data',
    'domain',
    'files',
    'firstChild',
    'firstElementChild',
    'host',
    'hostname',
    'href',
    'innerHTML',
    'innerText',
    'lastChild',
    'lastElementChild',
    'length',
    'listStyle',
    'listStyleImage',
    'location',
    'manifest',
    'onbeforeunload',
    'onerror',
    'onmessage',
    'origin',
    'pathname',
    'port',
    'protocol',
    'referrer',
    'sandbox',
    'search',
    'src',
    'target',
    'text',
    'textContent',
    'URL',
    'value',
    'which'
];

const INSTRUMENTED_METHOD_RE   = new RegExp(`^(${METHODS.join('|')})$`);
const INSTRUMENTED_PROPERTY_RE = new RegExp(`^(${PROPERTIES.join('|')})$`);

// NOTE: we can't use the map approach here, because
// cases like `WRAPPABLE_METHOD['toString']` will fail.
// We could use the hasOwnProperty test, but it is
// significantly slower than the regular expression test
export function shouldInstrumentMethod (name) {
    return INSTRUMENTED_METHOD_RE.test(name);
}

export function shouldInstrumentProperty (name) {
    return INSTRUMENTED_PROPERTY_RE.test(name);
}
