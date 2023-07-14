import fnBind from '../../../utils/fn-bind';
import { refreshAttributesWrapper, assignAttributes } from './index';

const ATTRIBUTES_METHODS = ['setNamedItem', 'setNamedItemNS', 'removeNamedItem', 'removeNamedItemNS', 'getNamedItem', 'getNamedItemNS'];

function createMethodWrapper (el, attributes, method) {
    return function () {
        const result = attributes[method].apply(attributes, arguments);

        refreshAttributesWrapper(el);

        return result;
    };
}

export default class AttributesWrapper {
    item: any;

    constructor (el, attributes) {
        assignAttributes(this, attributes);

        this.item = index => this[index];

        for (const field in attributes) {
            if (typeof this[field] === 'function' && field !== 'item') {
                this[field] = ATTRIBUTES_METHODS.indexOf(field) !== -1
                    ? createMethodWrapper(el, attributes, field)
                    : fnBind(attributes[field], attributes);
            }
        }

        this['getNamedItem'] = createMethodWrapper(el, attributes, 'getNamedItem');
    }
}
