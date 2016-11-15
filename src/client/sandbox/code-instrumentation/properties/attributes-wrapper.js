import { isHammerheadAttr } from '../../../utils/dom';
import { getStoredAttrName } from '../../../dom-processor';
import fnBind from '../../../utils/fn-bind';
import nativeMethods from '../../native-methods';

const ELEMENT_ATTRIBUTE_WRAPPERS_PROP = 'hammerhead|element-attribute-wrappers-prop';
const ATTRIBUTES_METHODS              = ['setNamedItem', 'setNamedItemNS', 'removeNamedItem', 'removeNamedItemNS', 'getNamedItem', 'getNamedItemNS'];

export default class AttributesWrapper {
    constructor (el) {
        el[ELEMENT_ATTRIBUTE_WRAPPERS_PROP] = el[ELEMENT_ATTRIBUTE_WRAPPERS_PROP] || [];
        el[ELEMENT_ATTRIBUTE_WRAPPERS_PROP].push(this);

        AttributesWrapper._assignAttributes.call(this, el.attributes);

        this.item = index => this[index];

        var _wrapMethod = method => {
            this[method] = (...args) => {
                var result = el.attributes[method].apply(el.attributes, args);

                AttributesWrapper.refreshWrappers(el);

                return result;
            };
        };

        for (var field in el.attributes) {
            if (typeof this[field] === 'function' && field !== 'item') {
                if (ATTRIBUTES_METHODS.indexOf(field) !== -1)
                    _wrapMethod(field);
                else
                    this[field] = fnBind(el.attributes[field], el.attributes);
            }
        }
    }

    static _assignAttributes (attributes) {
        AttributesWrapper._cleanAttributes();

        var length = 0;

        for (var i = 0; i < attributes.length; i++) {
            var attr = attributes[i];

            if (!isHammerheadAttr(attr.name)) {
                var storedAttrName = attributes[getStoredAttrName(attr.name)];

                if (storedAttrName) {
                    attr       = nativeMethods.cloneNode.call(attr);
                    attr.value = storedAttrName.value;
                    Object.defineProperty(this, attr.name, { value: attr, configurable: true });
                }

                Object.defineProperty(this, length, { value: attr, configurable: true });
                length++;
            }
        }

        Object.defineProperty(this, 'length', { value: length, configurable: true });
    }

    static _cleanAttributes () {
        if (this.length) {
            for (var i = this.length - 1; i >= 0; i--)
                delete this[i];
        }
    }

    static refreshWrappers (el) {
        var attrWrappers = el[ELEMENT_ATTRIBUTE_WRAPPERS_PROP];

        if (attrWrappers) {
            for (var i = 0; i < attrWrappers.length; i++)
                AttributesWrapper._assignAttributes.call(attrWrappers[i], el.attributes);
        }
    }
}
