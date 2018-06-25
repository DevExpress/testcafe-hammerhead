export const URL_ATTR_TAGS = {
    href:       ['a', 'link', 'image', 'area', 'base'],
    src:        ['img', 'embed', 'script', 'source', 'video', 'audio', 'input', 'frame', 'iframe'],
    action:     ['form'],
    formaction: ['button', 'input'],
    manifest:   ['html'],
    data:       ['object']
};

export const URL_ATTRS = Object.keys(URL_ATTR_TAGS);

export const ATTRS_WITH_SPECIAL_PROXYING_LOGIC = ['sandbox', 'autocomplete', 'target', 'formtarget', 'style'];
