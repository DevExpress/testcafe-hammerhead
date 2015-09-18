import nativeMethods from '../native-methods';
import { PROPERTY_PREFIX } from '../../../const';
import { isTextEditableElementAndEditingAllowed, isShadowUIElement } from '../../utils/dom';

const ELEMENT_EDITING_OBSERVED_FLAG = PROPERTY_PREFIX + 'elementEditingObserved';
const OLD_VALUE_PROPERTY            = PROPERTY_PREFIX + 'oldValue';

export default class ElementEditingWatcher {
    constructor (eventSimulator) {
        this.eventSimulator = eventSimulator;
    }

    _onBlur (e) {
        var target = e.target || e.srcElement;

        if (!this.processElementChanging(target))
            this.stopWatching(target);
    }

    _onChange (e) {
        this.stopWatching(e.target || e.srcElement);
    }

    stopWatching (el) {
        if (el) {
            nativeMethods.removeEventListener.call(el, 'blur', e => this._onBlur(e));
            nativeMethods.removeEventListener.call(el, 'change', e => this._onChange(e));

            if (el[ELEMENT_EDITING_OBSERVED_FLAG])
                delete el[ELEMENT_EDITING_OBSERVED_FLAG];

            if (el[OLD_VALUE_PROPERTY])
                delete el[OLD_VALUE_PROPERTY];
        }
    }

    watchElementEditing (el) {
        if (el && !el[ELEMENT_EDITING_OBSERVED_FLAG] &&
            isTextEditableElementAndEditingAllowed(el) && !isShadowUIElement(el)) {

            el[ELEMENT_EDITING_OBSERVED_FLAG] = true;
            el[OLD_VALUE_PROPERTY]            = el.value;


            nativeMethods.addEventListener.call(el, 'blur', e => this._onBlur(e));
            nativeMethods.addEventListener.call(el, 'change', e => this._onChange(e));
        }
    }

    restartWatchingElementEditing (el) {
        if (el && el[ELEMENT_EDITING_OBSERVED_FLAG])
            el[OLD_VALUE_PROPERTY] = el.value;
    }

    processElementChanging (el) {
        if (el && el[ELEMENT_EDITING_OBSERVED_FLAG] && el.value !== el[OLD_VALUE_PROPERTY]) {
            this.eventSimulator.change(el);
            this.restartWatchingElementEditing(el);

            return true;
        }

        return false;
    }
}
