export const wrappedMethods = {
    postMessage: true,
    write:       true,
    writeln:     true
};

export const wrappedProperties = {
    action:            true,
    activeElement:     true,
    attributes:        true,
    autocomplete:      true,
    background:        true,
    backgroundImage:   true,
    borderImage:       true,
    cookie:            true,
    cssText:           true,
    cursor:            true,
    data:              true,
    domain:            true,
    files:             true,
    firstChild:        true,
    firstElementChild: true,
    host:              true,
    hostname:          true,
    href:              true,
    innerHTML:         true,
    lastChild:         true,
    lastElementChild:  true,
    length:            true,
    listStyle:         true,
    listStyleImage:    true,
    location:          true,
    manifest:          true,
    onbeforeunload:    true,
    onerror:           true,
    onmessage:         true,
    origin:            true,
    pathname:          true,
    port:              true,
    protocol:          true,
    referrer:          true,
    sandbox:           true,
    search:            true,
    src:               true,
    target:            true,
    text:              true,
    textContent:       true,
    URL:               true,
    value:             true,
    which:             true
};

export const GET_LOCATION_METH_NAME   = '__get$Loc';
export const SET_LOCATION_METH_NAME   = '__set$Loc';
export const SET_PROPERTY_METH_NAME   = '__set$';
export const GET_PROPERTY_METH_NAME   = '__get$';
export const CALL_METHOD_METH_NAME    = '__call$';
export const PROCESS_SCRIPT_METH_NAME = '__proc$Script';

export const DOCUMENT_WRITE_BEGIN_PARAM = '__begin$';
export const DOCUMENT_WRITE_END_PARAM   = '__end$';
export const FOR_IN_TEMP_VAR_NAME       = '__set$temp';

export function needToWrapProperty (property) {
    return wrappedProperties[property] && wrappedProperties.hasOwnProperty(property);
}

export function needToWrapMethod (meth) {
    return wrappedMethods[meth] && wrappedMethods.hasOwnProperty(meth);
}
