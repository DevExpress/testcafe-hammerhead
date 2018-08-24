import DOMMutationTracker from './dom-mutation-tracker';
import nativeMethods from '../../native-methods';
import { isShadowUIElement } from '../../../utils/dom';

// NOTE: Tags from https://www.w3schools.com/tags/att_name.asp
const ELEMENTS_WITH_NAME_ATTRIBUTE = ['button', 'fieldset', 'form', 'iframe',
    'input', 'map', 'meta', 'object', 'output', 'param', 'select', 'textarea'];
const DEFAULT_SHADOW_GETTERS_SHIFT = 10;
let shadowGettersCount             = 0;

export default function HTMLCollectionWrapper (htmlCollection, tagName) {
    tagName = tagName.toLowerCase();

    nativeMethods.objectDefineProperties.call(Object, this, {
        htmlCollection:         { value: htmlCollection },
        filteredHtmlCollection: { value: [] },
        tagName:                { value: tagName },
        version:                { value: -Infinity, writable: true },
        namedProps:             { value: ELEMENTS_WITH_NAME_ATTRIBUTE.indexOf(tagName) !== -1 ? [] : null }
    });

    this.refreshHtmlCollection();
}

HTMLCollectionWrapper.prototype = nativeMethods.objectCreate.call(Object, HTMLCollection.prototype);

HTMLCollectionWrapper.prototype.item = function (index) {
    this.refreshHtmlCollection();

    return this.filteredHtmlCollection[index];
};

if (HTMLCollection.prototype.namedItem) {
    HTMLCollectionWrapper.prototype.namedItem = function (...args) {
        const findNamedItem = this.htmlCollection.namedItem.apply(this.htmlCollection, args);

        return findNamedItem && isShadowUIElement(findNamedItem) ? null : findNamedItem;
    };
}

Object.defineProperties(HTMLCollectionWrapper.prototype, {
    length: {
        configurable: true,
        enumerable:   true,
        get:          function () {
            this.refreshHtmlCollection();

            return this.filteredHtmlCollection.length;
        }
    },

    refreshHtmlCollection: {
        value: function () {
            if (!DOMMutationTracker.isOutdated(this.tagName, this.version))
                return;

            const storedFilteredCollectionLength = this.filteredHtmlCollection.length;
            const collectionLength               = nativeMethods.htmlCollectionLengthGetter.call(this.htmlCollection);
            const currentNamedProps              = this.namedProps ? [] : null;

            this.filteredHtmlCollection.length = 0;

            for (let i = 0; i < collectionLength; i++) {
                const el = this.htmlCollection[i];

                if (isShadowUIElement(el))
                    continue;

                this.filteredHtmlCollection.push(el);

                if (!currentNamedProps)
                    continue;

                const nameAttr = nativeMethods.getAttribute.call(el, 'name');

                if (nameAttr !== null)
                    currentNamedProps.push(nameAttr);
            }

            this.version = DOMMutationTracker.getVersion(this.tagName);

            updateHtmlCollectionElementGetters(this, storedFilteredCollectionLength, this.filteredHtmlCollection.length);

            if (currentNamedProps)
                updateNamedProps(this, this.namedProps, currentNamedProps);
        }
    }
});

addShadowGetters(DEFAULT_SHADOW_GETTERS_SHIFT);

function addShadowGetters (count) {
    for (let i = 0; i < count; i++) {
        const idx = shadowGettersCount++;

        nativeMethods.objectDefineProperty.call(Object, HTMLCollectionWrapper.prototype, idx, {
            get: function () {
                this.item(idx);
            }
        });
    }
}

function updateHtmlCollectionElementGetters (wrapper, oldLength, currentLength) {
    if (oldLength === currentLength)
        return;

    while (oldLength < currentLength) {
        const idx = oldLength++;

        nativeMethods.objectDefineProperty.call(Object, wrapper, idx, {
            enumerable:   true,
            configurable: true,
            get:          () => wrapper.item(idx)
        });
    }

    while (oldLength > currentLength)
        delete wrapper[--oldLength];

    if (currentLength > shadowGettersCount - DEFAULT_SHADOW_GETTERS_SHIFT)
        addShadowGetters(currentLength - (shadowGettersCount - DEFAULT_SHADOW_GETTERS_SHIFT));
}

function updateNamedProps (wrapper, oldNamedProps, currentNamedProps) {
    for (const oldProp of oldNamedProps) {
        if (currentNamedProps.indexOf(oldProp) === -1)
            delete wrapper[oldProp];
    }

    for (const prop of currentNamedProps) {
        if (!wrapper.htmlCollection[prop])
            continue;

        nativeMethods.objectDefineProperty.call(Object, wrapper, prop, {
            configurable: true,
            get:          function () {
                this.refreshHtmlCollection();

                return wrapper.htmlCollection[prop];
            }
        });
    }
}
