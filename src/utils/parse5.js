export function createElement (tagName, attrs) {
    return {
        nodeName:   tagName,
        tagName:    tagName,
        attrs:      attrs,
        childNodes: []
    };
}

export function insertElement (el, parent) {
    el.namespaceURI = parent.namespaceURI;
    el.parentNode   = parent;
    parent.childNodes.unshift(el);
}

export function removeNode (node) {
    var parent  = node.parentNode;
    var elIndex = parent.childNodes.indexOf(node);

    parent.childNodes.splice(elIndex, 1);
}

export function findElementsByTagNames (root, tagNames) {
    var elements = {};

    walkElements(root, el => {
        if (tagNames.indexOf(el.tagName) !== -1) {
            elements[el.tagName] = elements[el.tagName] || [];
            elements[el.tagName].push(el);
        }
    });

    return elements;
}

export function walkElements (el, processor) {
    if (el.nodeName !== '#document' && el.nodeName !== '#text' && el.nodeName !== '#documentType' &&
        el.nodeName !== '#comment')
        processor(el);

    if (el.childNodes)
        el.childNodes.forEach(child => walkElements(child, processor));
}

export function createTextNode (content, parent) {
    return {
        nodeName:   '#text',
        value:      content,
        parentNode: parent
    };
}
