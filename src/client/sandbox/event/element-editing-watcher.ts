import nativeMethods from '../native-methods';
import {
    isTextEditableElementAndEditingAllowed,
    isShadowUIElement,
    isInputElement,
    isTextAreaElement
} from '../../utils/dom';

import EventSimulator from './simulator';
import { isIE11 } from '../../utils/browser';

const ELEMENT_EDITING_OBSERVED_FLAG = 'hammerhead|element-editing-observed';
const OLD_VALUE_PROPERTY            = 'hammerhead|old-value';

export default class ElementEditingWatcher {
    constructor (private readonly _eventSimulator: EventSimulator) { //eslint-disable-line no-unused-vars
    }

    _onBlur (e): void {
        if (!this.processElementChanging(e.target))
            this.stopWatching(e.target);
    }

    _onChange (e): void {
        this.stopWatching(e.target);
    }

    static _getValue (el): string {
        if (isInputElement(el))
            return nativeMethods.inputValueGetter.call(el);
        else if (isTextAreaElement(el))
            return nativeMethods.textAreaValueGetter.call(el);

        // eslint-disable-next-line no-restricted-properties
        return el.value;
    }

    stopWatching (el): void {
        if (el) {
            const nativeRemoveEventListener = isIE11
                ? nativeMethods.removeEventListener
                : nativeMethods.eventTargetRemoveEventListener;

            nativeRemoveEventListener.call(el, 'blur', e => this._onBlur(e));
            nativeRemoveEventListener.call(el, 'change', e => this._onChange(e));

            if (el[ELEMENT_EDITING_OBSERVED_FLAG])
                delete el[ELEMENT_EDITING_OBSERVED_FLAG];

            if (el[OLD_VALUE_PROPERTY])
                delete el[OLD_VALUE_PROPERTY];
        }
    }

    watchElementEditing (el: HTMLElement): void {
        if (el && !el[ELEMENT_EDITING_OBSERVED_FLAG] &&
            isTextEditableElementAndEditingAllowed(el) && !isShadowUIElement(el)) {

            el[ELEMENT_EDITING_OBSERVED_FLAG] = true;
            el[OLD_VALUE_PROPERTY]            = ElementEditingWatcher._getValue(el);

            const nativeAddEventListener = isIE11
                ? nativeMethods.addEventListener
                : nativeMethods.eventTargetAddEventListener;

            nativeAddEventListener.call(el, 'blur', e => this._onBlur(e));
            nativeAddEventListener.call(el, 'change', e => this._onChange(e));
        }
    }

    restartWatchingElementEditing (el: HTMLElement): void {
        if (el && el[ELEMENT_EDITING_OBSERVED_FLAG])
            el[OLD_VALUE_PROPERTY] = ElementEditingWatcher._getValue(el);
    }

    processElementChanging (el: HTMLElement): boolean {
        if (el && el[ELEMENT_EDITING_OBSERVED_FLAG] && ElementEditingWatcher._getValue(el) !== el[OLD_VALUE_PROPERTY]) {
            this._eventSimulator.change(el);
            this.restartWatchingElementEditing(el);

            return true;
        }

        return false;
    }
}
