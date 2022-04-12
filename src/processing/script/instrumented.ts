// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

// NOTE: constants are exported for the testing purposes
export const METHODS = [
    'postMessage',
    'replace',
    'assign',
];

export const PROPERTIES = [
    'href',
    'location',
];

const INSTRUMENTED_METHOD_RE   = new RegExp(`^(${METHODS.join('|')})$`);
const INSTRUMENTED_PROPERTY_RE = new RegExp(`^(${PROPERTIES.join('|')})$`);

// NOTE: Mootools framework contains code that removes the RegExp.prototype.test
// method and restores it later.
//    delete z[A]; // z = RegExp.prototype, A = "test"
//    __set$(z, A, x.protect()); // x.protect - returns the removed method
// The __set$ function calls the test method of the regular expression. (GH-331)
const reTest = RegExp.prototype.test;
// NOTE: The Function.prototype.call method can also be removed.
// But only one of the methods can be removed at a time.
const test = (regexp, str: string) => regexp.test ? regexp.test(str) : reTest.call(regexp, str);

// NOTE: we can't use the map approach here, because
// cases like `WRAPPABLE_METHOD['toString']` will fail.
// We could use the hasOwnProperty test, but it is
// significantly slower than the regular expression test
export function shouldInstrumentMethod (name: string|number|boolean|RegExp|null|void): boolean {
    return test(INSTRUMENTED_METHOD_RE, String(name));
}

export function shouldInstrumentProperty (name: string|number|boolean|RegExp|null|void): boolean {
    return test(INSTRUMENTED_PROPERTY_RE, String(name));
}
