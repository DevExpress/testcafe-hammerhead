import nativeMethods from '../../native-methods';
import { getTagName, isShadowUIElement } from '../../../utils/dom';
import { getNativeQuerySelectorAll } from '../../../utils/query-selector';
import createIntegerIdGenerator from '../../../utils/integer-id-generator';

class DOMMutationTracker {
    constructor () {
        this._mutations          = nativeMethods.objectCreate.call(window.Object, null);
        this._isDomContentLoaded = false;

        nativeMethods.addEventListener.call(document, 'DOMContentLoaded', () => {
            this._isDomContentLoaded = true;
        });
    }

    _updateVersion (tagName) {
        if (tagName in this._mutations)
            this._mutations[tagName].increment();
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

        const isTagTracked = tagName in this._mutations;

        if (!isTagTracked)
            this._mutations[tagName] = createIntegerIdGenerator();

        const lastVersion = this._mutations[tagName].value; // eslint-disable-line no-restricted-properties

        return version < lastVersion;
    }

    getVersion (tagName) {
        if (tagName in this._mutations)
            return this._mutations[tagName].value; // eslint-disable-line no-restricted-properties

        return -Infinity;
    }
}

export default new DOMMutationTracker();
