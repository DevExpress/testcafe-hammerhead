import nativeMethods from '../../native-methods';
import { getTagName, isShadowUIElement, isShadowUIDiv } from '../../../utils/dom';
import { getNativeQuerySelectorAll } from '../../../utils/query-selector';
import IntegerIdGenerator from '../../../utils/integer-id-generator';
import ShadowUI from '../../shadow-ui';

class DOMMutationTracker {
    _mutations: any;
    _isDomContentLoaded: boolean;

    constructor () {
        this._mutations          = nativeMethods.objectCreate(null);
        this._isDomContentLoaded = false;
        nativeMethods.addEventListener.call(document, 'DOMContentLoaded', () => {
            for (const tagName of nativeMethods.objectKeys(this._mutations))
                this._updateVersion(tagName);

            this._isDomContentLoaded = true;

            const bodyChildNodes       = nativeMethods.nodeChildNodesGetter.call(document.body);
            const bodyChildNodesLength = nativeMethods.nodeListLengthGetter.call(bodyChildNodes);

            if (bodyChildNodesLength) {
                const lastBodyChild               = nativeMethods.nodeLastChildGetter.call(document.body);
                const lastBodyChildIsNotShadowDiv = ShadowUI.isShadowContainerCollection(bodyChildNodes) && !isShadowUIDiv(lastBodyChild);

                // GH-2418
                if (lastBodyChildIsNotShadowDiv)
                    ShadowUI.checkElementsPosition(bodyChildNodes, bodyChildNodesLength);
            }
        });
    }

    private _updateVersion (tagName: string): void {
        if (tagName in this._mutations)
            this._mutations[tagName].increment();
    }

    private _processElement (el: any): void {
        if (!el.tagName || isShadowUIElement(el))
            return;

        const tagName = getTagName(el);

        this._updateVersion('*');
        this._updateVersion(tagName);
    }

    private _processChildren (el: any): void {
        if (!el.querySelectorAll)
            return;

        const children = getNativeQuerySelectorAll(el).call(el, '*');
        const length   = nativeMethods.nodeListLengthGetter.call(children);

        for (let i = 0; i < length; i++)
            this._processElement(children[i]);
    }

    onElementChanged (el: any): void {
        this._processElement(el);
        this._processChildren(el);
    }

    onChildrenChanged (el: any): void {
        this._processChildren(el);
    }

    isDomContentLoaded (): boolean {
        return this._isDomContentLoaded;
    }

    isOutdated (tagName: string, version: number): boolean {
        const isTagTracked = tagName in this._mutations;

        if (!isTagTracked)
            this._mutations[tagName] = new IntegerIdGenerator();

        const lastVersion = this._mutations[tagName].value; // eslint-disable-line no-restricted-properties

        return version < lastVersion;
    }

    getVersion (tagName: string): number {
        if (tagName in this._mutations)
            return this._mutations[tagName].value; // eslint-disable-line no-restricted-properties

        return -Infinity;
    }
}

export default new DOMMutationTracker();
