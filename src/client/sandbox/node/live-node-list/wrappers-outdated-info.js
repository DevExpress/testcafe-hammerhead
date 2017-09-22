import nativeMethods from '../../native-methods';
import { getTagName, getClassList, isDocumentFragmentNode, isShadowUIElement } from '../../../utils/dom';
import { TAG_TYPE, CLASS_TYPE } from './wrapper-internal-info';

class WrappersOutdatedInfo {
    constructor () {
        this._tags    = nativeMethods.objectCreate.call(window.Object, null);
        this._classes = nativeMethods.objectCreate.call(window.Object, null);
        this._names   = nativeMethods.objectCreate.call(window.Object, null);

        this._tags['*'] = window.performance.now();

        this._isDomContentLoaded = false;

        nativeMethods.addEventListener.call(document, 'DOMContentLoaded', () => {
            this._isDomContentLoaded = true;
        });
    }

    _processElement (el, timestamp) {
        if (!el.tagName || isShadowUIElement(el))
            return;

        const tagName = getTagName(el);

        this._updateTag(tagName, timestamp);

        const name = nativeMethods.getAttribute.call(el, 'name');

        if (name && typeof name === 'string')
            this._names[name] = timestamp;

        const classList = getClassList(el);

        for (const className of classList)
            this._classes[className] = timestamp;
    }

    _updateTag (tagName, timestamp) {
        this._tags['*'] = timestamp;
        this._tags[tagName] = timestamp;
    }

    _processAllChildren (el, timestamp) {
        if (!el.querySelectorAll)
            return;

        let children;

        if (isDocumentFragmentNode(el))
            children = nativeMethods.documentFragmentQuerySelectorAll.call(el, '*');
        else
            children = nativeMethods.elementQuerySelectorAll.call(el, '*');

        for (const child of children)
            this._processElement(child, timestamp);
    }

    onElementAddedOrRemoved (el) {
        const timestamp = window.performance.now();

        this._processElement(el, timestamp);
        this._processAllChildren(el, timestamp);
    }

    onChildrenAddedOrRemoved (el, timestamp) {
        timestamp = timestamp || window.performance.now();

        this._processAllChildren(el, timestamp);
    }

    isWrapperOutdated (wrapperInternalInfo) {
        if (!this._isDomContentLoaded)
            return true;

        let collection;

        if (wrapperInternalInfo.type === TAG_TYPE)
            collection = this._tags;
        else if (wrapperInternalInfo.type === CLASS_TYPE)
            collection = this._classes;
        else
            collection = this._names;

        const updateTimestamp = collection[wrapperInternalInfo.data];

        if (typeof updateTimestamp === 'number')
            return wrapperInternalInfo.lastUpdateTimestamp < updateTimestamp;

        return true;
    }
}

export default new WrappersOutdatedInfo();
