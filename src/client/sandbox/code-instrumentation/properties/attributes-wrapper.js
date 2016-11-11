import { isHammerheadAttr } from '../../../utils/dom';
import { getStoredAttrName } from '../../../dom-processor';
import fnBind from '../../../utils/fn-bind';
import nativeMethods from '../../native-methods';

const ELEMENT_ATTRIBUTE_WRAPPERS_PROP = 'hammerhead|element-attribute-wrappers-prop';
const ATTRIBUTES_METHODS              = ['setNamedItem', 'setNamedItemNS', 'removeNamedItem', 'removeNamedItemNS', 'getNamedItem', 'getNamedItemNS'];

export default class AttributesWrapper {
    constructor (el) {
        Object.defineProperty(this, 'element', { value: el, configurable: true, enumerable: false });

        if (!el[ELEMENT_ATTRIBUTE_WRAPPERS_PROP])
            el[ELEMENT_ATTRIBUTE_WRAPPERS_PROP] = [];

        el[ELEMENT_ATTRIBUTE_WRAPPERS_PROP].push(this);

        AttributesWrapper._assignAttributes.call(this, el.attributes);

        this.item = index => this[index];

        var wrapper = this;

        for (var funcName in el.attributes) {
            if (typeof this[funcName] === 'function' && funcName !== 'item') {
                if (ATTRIBUTES_METHODS.indexOf(funcName) > -1) {
                    (function (name) {
                        wrapper[name] = function () {
                            var result = el.attributes[name].apply(el.attributes, arguments);

                            AttributesWrapper.refreshWrappers(el);

                            return result;
                        };
                    })(funcName);
                }
                else
                    this[funcName] = fnBind(el.attributes[funcName], el.attributes);
            }
        }
    }

    static _assignAttributes (attributes) {
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
        var length = this.length;

        for (var i = 0; i < length; i++)
            delete this[i];
    }

    static refreshWrappers (el) {
        if (el[ELEMENT_ATTRIBUTE_WRAPPERS_PROP]) {
            var length = el[ELEMENT_ATTRIBUTE_WRAPPERS_PROP].length;

            for (var i = 0; i < length; i++) {
                AttributesWrapper._cleanAttributes.call(el[ELEMENT_ATTRIBUTE_WRAPPERS_PROP][i]);
                AttributesWrapper._assignAttributes.call(el[ELEMENT_ATTRIBUTE_WRAPPERS_PROP][i], el.attributes);
            }
        }
    }
}
