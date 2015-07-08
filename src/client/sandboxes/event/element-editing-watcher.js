import * as DOM from '../../util/dom';
import * as EventSimulator from './simulator';
import NativeMethods from '../native-methods';
import Const from '../../../const';

const ELEMENT_EDITING_OBSERVED_FLAG = Const.PROPERTY_PREFIX + 'elementEditingObserved';
const OLD_VALUE_PROPERTY            = Const.PROPERTY_PREFIX + 'oldValue';

function onBlur (e) {
    var target = e.target || e.srcElement;

    if (!checkElementChanged(target))
        stopWatching(target);
}

function onChange (e) {
    stopWatching(e.target || e.srcElement);
}

function watchElement (element) {
    if (element && !element[ELEMENT_EDITING_OBSERVED_FLAG] &&
        DOM.isTextEditableElementAndEditingAllowed(element) && !DOM.isShadowUIElement(element)) {

        element[ELEMENT_EDITING_OBSERVED_FLAG] = true;
        element[OLD_VALUE_PROPERTY]            = element.value;


        NativeMethods.addEventListener.call(element, 'blur', onBlur);
        NativeMethods.addEventListener.call(element, 'change', onChange);
    }
}

function restartWatching (element) {
    if (element && element[ELEMENT_EDITING_OBSERVED_FLAG])
        element[OLD_VALUE_PROPERTY] = element.value;
}

function checkElementChanged (element) {
    if (element && element[ELEMENT_EDITING_OBSERVED_FLAG] && element.value !== element[OLD_VALUE_PROPERTY]) {
        EventSimulator.change(element);
        restartWatching(element);

        return true;
    }

    return false;
}

export function stopWatching (element) {
    if (element) {

        NativeMethods.removeEventListener.call(element, 'blur', onBlur);
        NativeMethods.removeEventListener.call(element, 'change', onChange);

        if (element[ELEMENT_EDITING_OBSERVED_FLAG])
            delete element[ELEMENT_EDITING_OBSERVED_FLAG];

        if (element[OLD_VALUE_PROPERTY])
            delete element[OLD_VALUE_PROPERTY];
    }
}

export var watchElementEditing           = watchElement;
export var restartWatchingElementEditing = restartWatching;
export var processElementChanging        = checkElementChanged;
