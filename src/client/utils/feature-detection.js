import nativeMethods from '../sandbox/native-methods';

// NOTE: In some browsers, elements without the url attribute return the location url
// when accessing this attribute directly. See form.action in Edge 25 as an example.
export var emptyActionAttrFallbacksToTheLocation = nativeMethods.createElement.call(document, 'form').action ===
                                                   window.location.toString();
