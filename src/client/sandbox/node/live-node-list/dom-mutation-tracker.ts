import nativeMethods from '../../native-methods';
import { getTagName, isShadowUIElement } from '../../../utils/dom';
import { getNativeQuerySelectorAll } from '../../../utils/query-selector';
import IntegerIdGenerator from '../../../utils/integer-id-generator';

class DOMMutationTracker {
    _mutations: any;
    _isDomContentLoaded: boolean;

    constructor () {
        this._mutations          = nativeMethods.objectCreate(null);
        this._isDomContentLoaded = false;

        nativeMethods.addEventListener.call(document, 'DOMContentLoaded', () => {
            this._isDomContentLoaded = true;
        });
    }

    _updateVersion (tagName: string) {
        if (tagName in this._mutations)
            this._mutations[tagName].increment();
    }

    _processElement (el: any) {
        if (!el.tagName || isShadowUIElement(el))
            return;

        const tagName = getTagName(el);

        this._updateVersion('*');
        this._updateVersion(tagName);
    }

    _processChildren (el: any) {
        if (!el.querySelectorAll)
            return;

        const children = getNativeQuerySelectorAll(el).call(el, '*');
        const length   = nativeMethods.nodeListLengthGetter.call(children);

        for (let i = 0; i < length; i++)
            this._processElement(children[i]);
    }

    onElementChanged (el: any) {
        this._processElement(el);
        this._processChildren(el);
    }

    onChildrenChanged (el: any) {
        this._processChildren(el);
    }

    isOutdated (tagName: string, version: number) {
        if (!this._isDomContentLoaded)
            return true;

        const isTagTracked = tagName in this._mutations;

        if (!isTagTracked)
            this._mutations[tagName] = new IntegerIdGenerator();

        const lastVersion = this._mutations[tagName].value; // eslint-disable-line no-restricted-properties

        return version < lastVersion;
    }

    getVersion (tagName: string) {
        if (tagName in this._mutations)
            return this._mutations[tagName].value; // eslint-disable-line no-restricted-properties

        return -Infinity;
    }
}

export default new DOMMutationTracker();
