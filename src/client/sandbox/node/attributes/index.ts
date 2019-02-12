import AttributesWrapper from './wrapper';
import { isHammerheadAttr } from '../../../utils/dom';
import nativeMethods from '../../native-methods';
import DomProcessor from '../../../../processing/dom';

const ATTRIBUTES_WRAPPER = 'hammerhead|element-attribute-wrappers';

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

            properties[attr.name] = { value: attr, configurable: true, enumerable: true };
            properties[length]    = { value: attr, configurable: true };
            length++;
        }
    }

    properties['length'] = { value: length, configurable: true };

    nativeMethods.objectDefineProperties(wrapper, properties);
}

export function getAttributes (el) {
    if (el[ATTRIBUTES_WRAPPER]) {
        refreshAttributesWrapper(el);

        return el[ATTRIBUTES_WRAPPER];
    }

    const attributes = nativeMethods.elementAttributesGetter.call(el);

    if (!attributes)
        return attributes;

    for (const attr of attributes) {
        if (isHammerheadAttr(attr.name)) {
            AttributesWrapper.prototype = attributes;

            el[ATTRIBUTES_WRAPPER] = new AttributesWrapper(el, attributes);

            return el[ATTRIBUTES_WRAPPER];
        }
    }

    return attributes;
}

export function refreshAttributesWrapper (el) {
    const attributesWrapper = el[ATTRIBUTES_WRAPPER];

    if (attributesWrapper) {
        cleanAttributes(attributesWrapper);
        assignAttributes(attributesWrapper, nativeMethods.elementAttributesGetter.call(el));
    }
}
