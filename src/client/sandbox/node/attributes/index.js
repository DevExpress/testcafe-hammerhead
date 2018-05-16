import AttributesWrapper from './wrapper';
import { isHammerheadAttr } from '../../../utils/dom';
import nativeMethods from '../../native-methods';

export function getAttributesProperty (el) {
    for (let i = 0; i < nativeMethods.elementAttributesGetter.call(el).length; i++) {
        if (isHammerheadAttr(nativeMethods.elementAttributesGetter.call(el)[i].name)) {
            AttributesWrapper.prototype = nativeMethods.elementAttributesGetter.call(el);

            return new AttributesWrapper(el);
        }
    }

    return nativeMethods.elementAttributesGetter.call(el);
}
