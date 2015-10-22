import { isHammerheadAttr } from '../../../utils/dom';
import { getStoredAttrName } from '../../../dom-processor';

export default class AttributesWrapper {
    constructor (attributes) {
        var length = 0;

        for (var i = 0; i < attributes.length; i++) {
            var attr = attributes[i];

            if (!isHammerheadAttr(attr.name)) {
                var storedAttrName = attributes[getStoredAttrName(attr.name)];

                if (storedAttrName) {
                    attr       = attr.cloneNode();
                    attr.value = storedAttrName.value;
                    Object.defineProperty(this, attr.name, { value: attr });
                }

                Object.defineProperty(this, length, { value: attr });
                length++;
            }
        }

        Object.defineProperty(this, 'length', { value: length });

        this.item = index => this[index];

        for (var funcName in attributes) {
            if (typeof this[funcName] === 'function' && funcName !== 'item')
                this[funcName] = attributes[funcName].bind(attributes);
        }
    }
}
