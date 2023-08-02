import { NAMESPACE_PREFIX_MAP } from '../processing/dom/namespaces';
import { Dictionary } from '../typings/common';
import {
    Node,
    Element,
    Document,
} from 'parse5/dist/tree-adapters/default';
import { Attribute } from 'parse5/dist/common/token';

const ATTR_NAMESPACE_LOCAL_NAME_SEPARATOR = ':';

const NON_ELEMENT_NODE_TYPES = [
    '#document',
    '#text',
    '#documentType',
    '#comment',
];

function isElementNode (el: Node): boolean {
    return !NON_ELEMENT_NODE_TYPES.includes(el.nodeName);
}

function getAttrName (attr: Attribute): string {
    return attr.prefix ? attr.prefix + ATTR_NAMESPACE_LOCAL_NAME_SEPARATOR + attr.name : attr.name;
}

function parseAttrName (attr: string): any {
    const parts = attr.split(ATTR_NAMESPACE_LOCAL_NAME_SEPARATOR);

    if (parts.length === 2) {
        return {
            prefix: parts[0],
            name:   parts[1],
        };
    }

    return {
        name: parts[0],
    };
}

function findAttr (el: Element, name: string): Attribute | null {
    for (let i = 0; i < el.attrs.length; i++) {
        if (getAttrName(el.attrs[i]) === name)
            return el.attrs[i];
    }
    return null;
}

export function createElement (tagName: string, attrs: Attribute[]): Element {
    return {
        nodeName:   tagName,
        tagName:    tagName,
        attrs:      attrs,
        childNodes: [] as Node[],
    } as Element;
}

export function unshiftElement (el: Element, parent: Element): void {
    el.namespaceURI = parent.namespaceURI;
    el.parentNode   = parent;

    parent.childNodes?.unshift(el); // eslint-disable-line no-unused-expressions
}

export function insertBeforeFirstScript (el: Element, parent: Element): void {
    const firstScriptIndex = findNodeIndex(parent, node => node.tagName === 'script');
    const insertIndex      = firstScriptIndex !== -1 ? firstScriptIndex : parent.childNodes?.length || 0;

    appendNode(el, parent, insertIndex);
}

export function findNodeIndex (parent: Element, predicate: (value: Element, index?: number, array?: Element[] ) => boolean): number {
    return parent && parent.childNodes
        ? parent.childNodes.findIndex(predicate as unknown as (value: Node, index?: number, array?: Node[]) => boolean)
        : -1;
}

export function findNextNonTextNode (parent: Element, startIndex: number): Node | null {
    if (!parent.childNodes)
        return null;

    let currentNode: Node;

    while (currentNode = parent.childNodes[startIndex]) { // eslint-disable-line no-cond-assign
        if (currentNode.nodeName !== '#text')
            return currentNode;

        startIndex++;
    }

    return currentNode;
}

export function appendNode (node: Element, parent: Element, index: number): void {
    node.namespaceURI = parent.namespaceURI;
    node.parentNode   = parent;

    parent.childNodes?.splice(index, 0, node); // eslint-disable-line no-unused-expressions
}

export function removeNode (node: Element): void {
    const parent  = node.parentNode;

    if (!parent || !parent.childNodes)
        return;

    const elIndex = parent.childNodes.indexOf(node);

    parent.childNodes.splice(elIndex, 1);
}

export function findElementsByTagNames (root: Element | Document, tagNames: string[]): Dictionary<Node[]> {
    const elements = {};

    walkElements(root, el => {
        if (tagNames.includes(el.tagName)) {
            elements[el.tagName] = elements[el.tagName] || [];
            elements[el.tagName].push(el);
        }
    });

    return elements;
}

export function findElement (el: Element, predicate: (el: Element) => boolean): Element | null { // eslint-disable-line no-shadow
    if (isElementNode(el) && predicate(el))
        return el;

    if (!el.childNodes)
        return null;

    for (const child of el.childNodes) {
        const result = findElement(child as Element, predicate);

        if (result)
            return result;
    }

    return null;
}

export function walkElements (el: Element | Document | ChildNode, processor: Function): void {
    if (isElementNode(el as Node))
        processor(el);

    if (el.childNodes)
        el.childNodes.forEach(child => walkElements(child, processor));
}

export function createTextNode (content: string, parent: Node): Node {
    return {
        nodeName:   '#text',
        value:      content,
        parentNode: parent,
    } as Node;
}

export function removeAttr (el: Element, name: string): void {
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

export function setAttr (el: Element, name: string, value: string): string {
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
