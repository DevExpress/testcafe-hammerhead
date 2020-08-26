import nativeMethods from '../native-methods';
import {
    isTextEditableElementAndEditingAllowed,
    isShadowUIElement,
    isInputElement,
    isTextAreaElement
} from '../../utils/dom';
import EventSimulator from './simulator';

const EDITING_OBSERVED_FLAG   = 'hammerhead|editing-observed';
const PREVIOUS_VALUE_PROPERTY = 'hammerhead|previous-value';

export default class ElementEditingWatcher {
    constructor (private readonly _eventSimulator: EventSimulator) {
    }

    private _onBlur (e): void {
        if (!this.processElementChanging(e.target))
            this.stopWatching(e.target);
    }

    private _onChange (e): void {
        this.stopWatching(e.target);
    }

    private static _getValue (el): string {
        if (isInputElement(el))
            return nativeMethods.inputValueGetter.call(el);
        else if (isTextAreaElement(el))
            return nativeMethods.textAreaValueGetter.call(el);

        // eslint-disable-next-line no-restricted-properties
        return el.value;
    }

    stopWatching (el: HTMLElement): void {
        if (!el)
            return;

        nativeMethods.removeEventListener.call(el, 'blur', e => this._onBlur(e));
        nativeMethods.removeEventListener.call(el, 'change', e => this._onChange(e));

        if (el[EDITING_OBSERVED_FLAG] !== void 0)
            delete el[EDITING_OBSERVED_FLAG];

        if (el[PREVIOUS_VALUE_PROPERTY] !== void 0)
            delete el[PREVIOUS_VALUE_PROPERTY];
    }

    watchElementEditing (el: HTMLElement): void {
        if (!el || el[EDITING_OBSERVED_FLAG] || !isTextEditableElementAndEditingAllowed(el) || isShadowUIElement(el))
            return;

        nativeMethods.objectDefineProperties(el, {
            [EDITING_OBSERVED_FLAG]:   { value: true, configurable: true, writable: true },
            [PREVIOUS_VALUE_PROPERTY]: { value: ElementEditingWatcher._getValue(el), configurable: true, writable: true }
        });

        nativeMethods.addEventListener.call(el, 'blur', e => this._onBlur(e));
        nativeMethods.addEventListener.call(el, 'change', e => this._onChange(e));
    }

    restartWatchingElementEditing (el: HTMLElement): void {
        if (el && el[EDITING_OBSERVED_FLAG])
            el[PREVIOUS_VALUE_PROPERTY] = ElementEditingWatcher._getValue(el);
    }

    processElementChanging (el: HTMLElement): boolean {
        if (el && el[EDITING_OBSERVED_FLAG] && ElementEditingWatcher._getValue(el) !== el[PREVIOUS_VALUE_PROPERTY]) {
            this._eventSimulator.change(el);
            this.restartWatchingElementEditing(el);

            return true;
        }

        return false;
    }

    getElementSavedValue (el: HTMLElement) {
        return el[PREVIOUS_VALUE_PROPERTY];
    }

    isEditingObserved (el: HTMLElement) {
        return el[EDITING_OBSERVED_FLAG];
    }
}
