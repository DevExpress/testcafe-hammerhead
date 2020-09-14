import { NAMESPACE_PREFIX_MAP } from '../processing/dom/namespaces';
import { ASTAttribute, ASTNode } from 'parse5';
import { Dictionary } from '../typings/common';

const ATTR_NAMESPACE_LOCAL_NAME_SEPARATOR = ':';

function isElementNode (el: ASTNode): boolean {
    return el.nodeName !== '#document' &&
        el.nodeName !== '#text' &&
        el.nodeName !== '#documentType' &&
        el.nodeName !== '#comment';
}

function getAttrName (attr: ASTAttribute): string {
    return attr.prefix ? attr.prefix + ATTR_NAMESPACE_LOCAL_NAME_SEPARATOR + attr.name : attr.name;
}

function parseAttrName (attr: string): any {
    const parts = attr.split(ATTR_NAMESPACE_LOCAL_NAME_SEPARATOR);

    if (parts.length === 2) {
        return {
            prefix: parts[0],
            name:   parts[1]
        };
    }

    return {
        name: parts[0]
    };
}

function findAttr (el: ASTNode, name: string): ASTAttribute | null {
    for (let i = 0; i < el.attrs.length; i++) {
        if (getAttrName(el.attrs[i]) === name)
            return el.attrs[i];
    }
    return null;
}

export function createElement (tagName: string, attrs: ASTAttribute[]): ASTNode {
    return {
        nodeName:   tagName,
        tagName:    tagName,
        attrs:      attrs,
        childNodes: []
    } as ASTNode;
}

export function unshiftElement (el: ASTNode, parent: ASTNode): void {
    el.namespaceURI = parent.namespaceURI;
    el.parentNode   = parent;
    parent.childNodes.unshift(el);
}

export function insertBeforeFirstScript (el: ASTNode, parent: ASTNode): void {
    const firstScriptIndex = findNodeIndex(parent, node => node.tagName === 'script');
    const insertIndex      = firstScriptIndex !== -1 ? firstScriptIndex : parent.childNodes.length;

    appendNode(el, parent, insertIndex);
}

export function findNodeIndex (parent: ASTNode, predicate: (value: ASTNode, index?: number, array?: ASTNode[] ) => boolean): number {
    return parent && parent.childNodes
        ? parent.childNodes.findIndex(predicate)
        : -1;
}

export function findNextNonTextNode (parent: ASTNode, startIndex: number): ASTNode | null {
    let currentNode = null;

    while (currentNode = parent.childNodes[startIndex]){
        if (currentNode.nodeName !== '#text')
            return currentNode;

        startIndex++;
    }

    return currentNode;
}

export function appendNode (node: ASTNode, parent: ASTNode, index: number): void {
    node.namespaceURI = parent.namespaceURI;
    node.parentNode   = parent;

    parent.childNodes.splice(index, 0, node);
}

export function removeNode (node: ASTNode): void {
    const parent  = node.parentNode;
    const elIndex = parent.childNodes.indexOf(node);

    parent.childNodes.splice(elIndex, 1);
}

export function findElementsByTagNames (root: ASTNode, tagNames: string[]): Dictionary<ASTNode[]> {
    const elements = {};

    walkElements(root, el => {
        if (tagNames.includes(el.tagName)) {
            elements[el.tagName] = elements[el.tagName] || [];
            elements[el.tagName].push(el);
        }
    });

    return elements;
}

export function findElement (el: ASTNode, predicate: (el: ASTNode) => boolean): ASTNode | null {
    if (isElementNode(el) && predicate(el))
        return el;

    if (!el.childNodes)
        return null;

    for (let child of el.childNodes) {
        const result = findElement(child, predicate);

        if (result)
            return result;
    }

    return null;
}

export function walkElements (el: ASTNode, processor: Function): void {
    if (isElementNode(el))
        processor(el);

    if (el.childNodes)
        el.childNodes.forEach(child => walkElements(child, processor));
}

export function createTextNode (content: string, parent: ASTNode): ASTNode {
    return {
        nodeName:   '#text',
        value:      content,
        parentNode: parent
    } as ASTNode;
}

export function removeAttr (el: ASTNode, name: string): void {
    for (let i = 0; i < el.attrs.length; i++) {
        if (getAttrName(el.attrs[i]) === name) {
            el.attrs.splice(i, 1);

            return;
        }
    }
}

export function getAttr (el, name: string): string | null {
    const attr = findAttr(el, name);

    return attr ? attr.value : null;
}

export function setAttr (el: ASTNode, name: string, value: string): string {
    const attr = findAttr(el, name);

    if (attr) {
        attr.value = value;

        return value;
    }

    const parsedAttrName = parseAttrName(name);
    const newAttr        = { name: parsedAttrName.name, value: value, namespace: void 0 };

    if (parsedAttrName.prefix && NAMESPACE_PREFIX_MAP[parsedAttrName.prefix])
        newAttr.namespace = NAMESPACE_PREFIX_MAP[parsedAttrName.prefix];

    el.attrs.push(newAttr);

    return value;
}
