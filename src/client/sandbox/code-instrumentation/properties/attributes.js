import AttributesWrapper from './attributes-wrapper';
import { isHammerheadAttr } from '../../../utils/dom';

export function getAttributesProperty (el) {
    for (let i = 0; i < el.attributes.length; i++) {
        if (isHammerheadAttr(el.attributes[i].name)) {
            AttributesWrapper.prototype = el.attributes;

            return new AttributesWrapper(el);
        }
    }

    return el.attributes;
}
