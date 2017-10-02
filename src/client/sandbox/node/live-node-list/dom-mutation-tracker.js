import nativeMethods from '../../native-methods';
import { getTagName, isDocumentFragmentNode, isShadowUIElement } from '../../../utils/dom';

const MAX_SAFE_INTEGER = Math.pow(2, 53) - 1;
const MIN_SAFE_INTEGER = -MAX_SAFE_INTEGER;

class DOMMutationTracker {
    constructor () {
        this._tags               = nativeMethods.objectCreate.call(window.Object, null);
        this._isDomContentLoaded = false;

        nativeMethods.addEventListener.call(document, 'DOMContentLoaded', () => {
            this._isDomContentLoaded = true;
        });
    }

    _updateVersion (tagName) {
        if (tagName in this._tags) {
            if (this._tags[tagName] === MAX_SAFE_INTEGER)
                this._tags[tagName] = MIN_SAFE_INTEGER;
            else
                ++this._tags[tagName];
        }
        else
            this._tags[tagName] = MIN_SAFE_INTEGER;
    }

    _processElement (el) {
        if (!el.tagName || isShadowUIElement(el))
            return;

        const tagName = getTagName(el);

        this._updateVersion('*');
        this._updateVersion(tagName);
    }

    _processAllChildren (el) {
        if (!el.querySelectorAll)
            return;

        let children;

        if (isDocumentFragmentNode(el))
            children = nativeMethods.documentFragmentQuerySelectorAll.call(el, '*');
        else
            children = nativeMethods.elementQuerySelectorAll.call(el, '*');

        for (const child of children)
            this._processElement(child);
    }

    onElementAddedOrRemoved (el) {
        this._processElement(el);
        this._processAllChildren(el);
    }

    onChildrenAddedOrRemoved (el) {
        this._processAllChildren(el);
    }

    isWrapperOutdated (tagName, version) {
        if (!this._isDomContentLoaded)
            return true;

        const lastVersion = this._tags[tagName];

        if (typeof lastVersion === 'number')
            return version < lastVersion;

        this._updateVersion(tagName);

        return true;
    }

    getVersion (tagName) {
        return this._tags[tagName];
    }
}

export default new DOMMutationTracker();
