import nativeMethods from '../sandbox/native-methods';

// NOTE: In some browsers, elements without the url attribute return the location url
// when accessing this attribute directly. See form.action in Edge 25 as an example.
export const emptyActionAttrFallbacksToTheLocation = nativeMethods.createElement.call(document, 'form').action ===
                                                     window.location.toString();

// NOTE: In Chrome, toString(window) equals '[object Window]' and toString(Window.prototype) equals '[object Blob]',
// this condition is also satisfied for Blob, Document, XMLHttpRequest, etc
export const instanceAndPrototypeToStringAreEqual = nativeMethods.objectToString.call(window) ===
                                                    nativeMethods.objectToString.call(Window.prototype);
