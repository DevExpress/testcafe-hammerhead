// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

export const URL_ATTR_TAGS = {
    href:       ['a', 'link', 'image', 'area', 'base'],
    src:        ['img', 'embed', 'script', 'source', 'video', 'audio', 'input', 'frame', 'iframe'],
    srcset:     ['img', 'source'],
    action:     ['form'],
    formaction: ['button', 'input'],
    manifest:   ['html'],
    data:       ['object'],
};

export const URL_ATTRS = ['href', 'src', 'action', 'formaction', 'manifest', 'data'];

export const TARGET_ATTR_TAGS = {
    target:     ['a', 'form', 'area', 'base'],
    formtarget: ['input', 'button'],
};

export const TARGET_ATTRS = ['target', 'formtarget'];

export const ATTRS_WITH_SPECIAL_PROXYING_LOGIC = ['sandbox', 'autocomplete', 'target', 'formtarget', 'style'];
