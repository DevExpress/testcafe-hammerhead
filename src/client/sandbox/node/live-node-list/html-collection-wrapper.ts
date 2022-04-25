import DOMMutationTracker from './dom-mutation-tracker';
import nativeMethods from '../../native-methods';
import { isShadowUIElement } from '../../../utils/dom';

// NOTE: Tags from https://www.w3schools.com/tags/att_name.asp
const ELEMENTS_WITH_NAME_ATTRIBUTE     = ['button', 'fieldset', 'form', 'iframe',
    'input', 'map', 'meta', 'object', 'output', 'param', 'select', 'textarea'];
const COLLECTION_PROTO_GETTERS_RESERVE = 10;
let collectionProtoGettersCount        = 0;

class HTMLCollectionInheritor {}

HTMLCollectionInheritor.prototype = HTMLCollection.prototype;

export default class HTMLCollectionWrapper extends HTMLCollectionInheritor {
    _collection: HTMLCollection;
    _filteredCollection: HTMLElement[];
    _tagName: HTMLElement['tagName'];
    _version: number;
    _namedProps: string[];
    _lastNativeLength: number;

    constructor (collection: HTMLCollection, tagName: string) {
        super();

        tagName = tagName.toLowerCase();

        nativeMethods.objectDefineProperties(this, {
            _collection:         { value: collection },
            _filteredCollection: { value: [] },
            _tagName:            { value: tagName },
            _version:            { value: -Infinity, writable: true },
            _namedProps:         { value: ELEMENTS_WITH_NAME_ATTRIBUTE.indexOf(tagName) !== -1 ? [] : null },
            _lastNativeLength:   { value: 0, writable: true },
        });

        this._refreshCollection();
    }

    item (index: number) {
        this._refreshCollection();

        return this._filteredCollection[index];
    }

    get length () {
        this._refreshCollection();

        return this._filteredCollection.length;
    }

    _refreshCollection () {
        const storedNativeCollectionLength = this._lastNativeLength;
        const nativeCollectionLength       = nativeMethods.htmlCollectionLengthGetter.call(this._collection);

        this._lastNativeLength = nativeCollectionLength;

        if (!DOMMutationTracker.isOutdated(this._tagName, this._version) &&
            (DOMMutationTracker.isDomContentLoaded() || storedNativeCollectionLength === nativeCollectionLength))
            return;

        const storedFilteredCollectionLength = this._filteredCollection.length;
        const currentNamedProps              = filterCollection(this, nativeCollectionLength);

        this._version = DOMMutationTracker.getVersion(this._tagName);

        updateCollectionIndexGetters(this, storedFilteredCollectionLength, this._filteredCollection.length);
        updateNamedProps(this, this._namedProps, currentNamedProps);
    }
}

const additionalProtoMethods = {
    constructor: {
        value:        HTMLCollectionWrapper.constructor,
        configurable: true,
        enumerable:   false,
        writable:     true,
    },

    _refreshCollection: {
        value:      HTMLCollectionWrapper.prototype._refreshCollection,
        enumerable: false,
    },
} as PropertyDescriptorMap;

if (HTMLCollection.prototype.namedItem) {
    additionalProtoMethods.namedItem = {
        value: function (this: HTMLCollectionWrapper, ...args: [string]) {
            this._refreshCollection();

            const namedItem = this._collection.namedItem.apply(this._collection, args);

            return namedItem && isShadowUIElement(namedItem) ? null : namedItem;
        },
        enumerable:   true,
        configurable: true,
        writable:     true,
    };
}

nativeMethods.objectDefineProperties(HTMLCollectionWrapper.prototype, additionalProtoMethods);

addShadowGetters(COLLECTION_PROTO_GETTERS_RESERVE);

function addShadowGetters (count: number) {
    for (let i = 0; i < count; i++) {
        const idx = collectionProtoGettersCount++;

        nativeMethods.objectDefineProperty(HTMLCollectionWrapper.prototype, idx, {
            get: function () {
                this.item(idx);
            },
        });
    }
}

function updateCollectionIndexGetters (wrapper: HTMLCollectionWrapper, oldLength: number, currentLength: number) {
    if (oldLength === currentLength)
        return;

    while (oldLength < currentLength) {
        const idx = oldLength++;

        nativeMethods.objectDefineProperty(wrapper, idx, {
            enumerable:   true,
            configurable: true,
            get:          () => wrapper.item(idx),
        });
    }

    while (oldLength > currentLength)
        delete wrapper[--oldLength];

    const maxCollectionLength = collectionProtoGettersCount - COLLECTION_PROTO_GETTERS_RESERVE;

    if (currentLength > maxCollectionLength)
        addShadowGetters(currentLength - maxCollectionLength);
}

function updateNamedProps (wrapper: HTMLCollectionWrapper, oldNamedProps, currentNamedProps) {
    if (!currentNamedProps)
        return;

    for (const oldProp of oldNamedProps) {
        if (currentNamedProps.indexOf(oldProp) === -1)
            delete wrapper[oldProp];
    }

    for (const prop of currentNamedProps) {
        if (!wrapper._collection[prop])
            continue;

        nativeMethods.objectDefineProperty(wrapper, prop, {
            configurable: true,
            get:          function () {
                this._refreshCollection();

                return wrapper._collection[prop];
            },
        });
    }
}

function filterCollection (wrapper: HTMLCollectionWrapper, nativeCollectionLength: number) {
    const nativeCollection       = wrapper._collection;
    const currentNamedProps      = wrapper._namedProps ? [] : null;
    const filteredCollection     = wrapper._filteredCollection;

    filteredCollection.length = 0;

    for (let i = 0; i < nativeCollectionLength; i++) {
        const el = nativeCollection[i] as HTMLElement;

        if (isShadowUIElement(el))
            continue;

        filteredCollection.push(el);

        if (!currentNamedProps)
            continue;

        const nameAttr = nativeMethods.getAttribute.call(el, 'name');

        if (nameAttr !== null)
            currentNamedProps.push(nameAttr);
    }

    return currentNamedProps;
}
