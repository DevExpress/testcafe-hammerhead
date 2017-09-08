import { isHammerheadAttr } from '../../../utils/dom';
import { getStoredAttrName } from '../../../dom-processor';
import fnBind from '../../../utils/fn-bind';
import nativeMethods from '../../native-methods';
import DomProcessor from '../../../../processing/dom';

const ELEMENT_ATTRIBUTE_WRAPPERS_PROP = 'hammerhead|element-attribute-wrappers-prop';
const ATTRIBUTES_METHODS              = ['setNamedItem', 'setNamedItemNS', 'removeNamedItem', 'removeNamedItemNS', 'getNamedItem', 'getNamedItemNS'];

export default class AttributesWrapper {
    constructor (el) {
        el[ELEMENT_ATTRIBUTE_WRAPPERS_PROP] = el[ELEMENT_ATTRIBUTE_WRAPPERS_PROP] || [];
        el[ELEMENT_ATTRIBUTE_WRAPPERS_PROP].push(this);

        AttributesWrapper._assignAttributes.call(this, el.attributes);

        this.item = index => this[index];

        const wrapMethod = method => {
            this[method] = (...args) => {
                const result = el.attributes[method].apply(el.attributes, args);

                AttributesWrapper.refreshWrappers(el);

                return result;
            };
        };

        for (const field in el.attributes) {
            if (typeof this[field] === 'function' && field !== 'item') {
                if (ATTRIBUTES_METHODS.indexOf(field) !== -1)
                    wrapMethod(field);
                else
                    this[field] = fnBind(el.attributes[field], el.attributes);
            }
        }
    }

    static _assignAttributes (attributes) {
        let length = 0;

        for (let i = 0; i < attributes.length; i++) {
            let attr = attributes[i];

            if (!isHammerheadAttr(attr.name)) {
                const storedAttr = attributes[getStoredAttrName(attr.name)];

                if (storedAttr) {
                    if (DomProcessor.isAddedAutocompleteAttr(attr.name, storedAttr.value))
                        continue;

                    attr = nativeMethods.cloneNode.call(attr);
                    attr.value = storedAttr.value;
                    nativeMethods.objectDefineProperty.call(window.Object, this, attr.name, {
                        value:        attr,
                        configurable: true
                    });
                }

                nativeMethods.objectDefineProperty.call(window.Object, this, length, { value: attr, configurable: true });
                length++;
            }
        }

        nativeMethods.objectDefineProperty.call(window.Object, this, 'length', { value: length, configurable: true });
    }

    static _cleanAttributes () {
        if (this.length) {
            for (let i = this.length - 1; i >= 0; i--)
                delete this[i];
        }
    }

    static refreshWrappers (el) {
        const attrWrappers = el[ELEMENT_ATTRIBUTE_WRAPPERS_PROP];

        if (attrWrappers) {
            for (let i = 0; i < attrWrappers.length; i++) {
                AttributesWrapper._cleanAttributes.call(attrWrappers[i], el.attributes);
                AttributesWrapper._assignAttributes.call(attrWrappers[i], el.attributes);
            }
        }
    }
}
