import AttributesWrapper from './wrapper';
import { isHammerheadAttr } from '../../../utils/dom';
import nativeMethods from '../../native-methods';
import DomProcessor from '../../../../processing/dom';

const ELEMENT_ATTRIBUTE_WRAPPERS_PROP = 'hammerhead|element-attribute-wrappers-prop';

function cleanAttributes (wrapper) {
    if (wrapper.length) {
        for (let i = 0; i < wrapper.length; i++) {
            delete wrapper[wrapper[i].name];
            delete wrapper[i];
        }
    }
}

export function assignAttributes (wrapper, attributes) {
    let length       = 0;
    const properties = {};

    for (let attr of attributes) {
        if (!isHammerheadAttr(attr.name)) {
            const storedAttr = attributes[DomProcessor.getStoredAttrName(attr.name)];

            if (storedAttr) {
                // eslint-disable-next-line no-restricted-properties
                if (DomProcessor.isAddedAutocompleteAttr(attr.name, storedAttr.value))
                    continue;

                attr = nativeMethods.cloneNode.call(attr);

                // eslint-disable-next-line no-restricted-properties
                attr.value = storedAttr.value;
            }

            properties[attr.name] = { value: attr, configurable: true };
            properties[length]    = { value: attr, configurable: true };
            length++;
        }
    }

    properties['length'] = { value: length, configurable: true };

    nativeMethods.objectDefineProperties.call(window.Object, wrapper, properties);
}

export function getAttributesProperty (el) {
    if (el[ELEMENT_ATTRIBUTE_WRAPPERS_PROP])
        return el[ELEMENT_ATTRIBUTE_WRAPPERS_PROP];

    const attributes = nativeMethods.elementAttributesGetter.call(el);

    if (!attributes)
        return attributes;

    for (const attr of attributes) {
        if (isHammerheadAttr(attr.name)) {
            AttributesWrapper.prototype = attributes;

            el[ELEMENT_ATTRIBUTE_WRAPPERS_PROP] = new AttributesWrapper(el, attributes);

            return el[ELEMENT_ATTRIBUTE_WRAPPERS_PROP];
        }
    }

    return attributes;
}

export function refreshAttributesWrapper (el) {
    const attributesWrapper = el[ELEMENT_ATTRIBUTE_WRAPPERS_PROP];

    if (attributesWrapper) {
        cleanAttributes(attributesWrapper);
        assignAttributes(attributesWrapper, nativeMethods.elementAttributesGetter.call(el));
    }
}
