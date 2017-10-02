import nativeMethods from '../../native-methods';
import { getTagName, isShadowUIElement } from '../../../utils/dom';
import getNativeQuerySelectorAll from '../../../utils/get-native-query-selector-all';

const MAX_SAFE_INTEGER = Math.pow(2, 53) - 1;
const MIN_SAFE_INTEGER = -MAX_SAFE_INTEGER;

class DOMMutationTracker {
    constructor () {
        this._mutations          = nativeMethods.objectCreate.call(window.Object, null);
        this._isDomContentLoaded = false;

        nativeMethods.addEventListener.call(document, 'DOMContentLoaded', () => {
            this._isDomContentLoaded = true;
        });
    }

    _updateVersion (tagName) {
        if (tagName in this._mutations) {
            if (this._mutations[tagName] === MAX_SAFE_INTEGER)
                this._mutations[tagName] = MIN_SAFE_INTEGER;
            else
                ++this._mutations[tagName];
        }
        else
            this._mutations[tagName] = MIN_SAFE_INTEGER;
    }

    _processElement (el) {
        if (!el.tagName || isShadowUIElement(el))
            return;

        const tagName = getTagName(el);

        this._updateVersion('*');
        this._updateVersion(tagName);
    }

    _processChildren (el) {
        if (!el.querySelectorAll)
            return;

        const children = getNativeQuerySelectorAll(el).call(el, '*');

        for (const child of children)
            this._processElement(child);
    }

    onElementChanged (el) {
        this._processElement(el);
        this._processChildren(el);
    }

    onChildrenChanged (el) {
        this._processChildren(el);
    }

    isOutdated (tagName, version) {
        if (!this._isDomContentLoaded)
            return true;

        const lastVersion = this._mutations[tagName];

        if (typeof lastVersion === 'number')
            return version < lastVersion;

        this._updateVersion(tagName);

        return true;
    }

    getVersion (tagName) {
        return this._mutations[tagName];
    }
}

export default new DOMMutationTracker();
