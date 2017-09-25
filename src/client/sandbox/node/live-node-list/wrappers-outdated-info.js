import nativeMethods from '../../native-methods';
import { getTagName, getClassList, isDocumentFragmentNode, isShadowUIElement } from '../../../utils/dom';
import { TAG_TYPE, CLASS_TYPE } from './wrapper-internal-info';

const MAX_SAFE_INTEGER = Math.pow(2, 53) - 1;
const MIN_SAFE_INTEGER = -MAX_SAFE_INTEGER;

class WrappersOutdatedInfo {
    constructor () {
        this._tags    = nativeMethods.objectCreate.call(window.Object, null);
        this._classes = nativeMethods.objectCreate.call(window.Object, null);
        this._names   = nativeMethods.objectCreate.call(window.Object, null);

        this._isDomContentLoaded = false;

        nativeMethods.addEventListener.call(document, 'DOMContentLoaded', () => {
            this._isDomContentLoaded = true;
        });
    }

    static _updateVersion (collection, property) {
        if (property in collection) {
            if (collection[property] === MAX_SAFE_INTEGER)
                collection[property] = MIN_SAFE_INTEGER;
            else
                ++collection[property];
        }
    }

    _processElement (el) {
        if (!el.tagName || isShadowUIElement(el))
            return;

        const tagName = getTagName(el);

        this._updateTag(tagName);

        const name = nativeMethods.getAttribute.call(el, 'name');

        if (name && typeof name === 'string')
            WrappersOutdatedInfo._updateVersion(this._names, name);

        const classList = getClassList(el);

        for (const className of classList)
            WrappersOutdatedInfo._updateVersion(this._classes, className);
    }

    _updateTag (tagName) {
        WrappersOutdatedInfo._updateVersion(this._tags, '*');
        WrappersOutdatedInfo._updateVersion(this._tags, tagName);
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

    _getCollectionByType (type) {
        if (type === TAG_TYPE)
            return this._tags;
        else if (type === CLASS_TYPE)
            return this._classes;

        return this._names;
    }

    onElementAddedOrRemoved (el) {
        this._processElement(el);
        this._processAllChildren(el);
    }

    onChildrenAddedOrRemoved (el) {
        this._processAllChildren(el);
    }

    isWrapperOutdated (wrapperInternalInfo) {
        if (!this._isDomContentLoaded)
            return true;

        const collection  = this._getCollectionByType(wrapperInternalInfo.type);
        const lastVersion = collection[wrapperInternalInfo.data];

        if (typeof lastVersion === 'number')
            return wrapperInternalInfo.version < lastVersion;

        collection[wrapperInternalInfo.data] = MIN_SAFE_INTEGER;

        return true;
    }

    getCurrentVersion (wrapperInternalInfo) {
        return this._getCollectionByType(wrapperInternalInfo.type)[wrapperInternalInfo.data];
    }
}

export default new WrappersOutdatedInfo();
