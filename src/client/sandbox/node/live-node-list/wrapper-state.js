import DOMMutationTracker from './dom-mutation-tracker';
import { isShadowUIElement } from '../../../utils/dom';

const arrayFilter = Array.prototype.filter;

export default class WrapperState {
    constructor (nodeList, tagName) {
        this.nodeList         = nodeList;
        this.filteredNodeList = null;
        this.version          = DOMMutationTracker.getVersion(this.tagName);
        this.tagName          = tagName;

        this.refreshNodeListIfNecessary();
    }

    refreshNodeListIfNecessary () {
        if (DOMMutationTracker.isOutdated(this.tagName, this.version)) {
            this.filteredNodeList = arrayFilter.call(this.nodeList, element => !isShadowUIElement(element));
            this.version          = DOMMutationTracker.getVersion(this.tagName);
        }
    }
}
