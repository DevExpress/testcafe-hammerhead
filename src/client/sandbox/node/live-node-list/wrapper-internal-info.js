import { isShadowUIElement } from '../../../utils/dom';
import wrappersUpdateInfo from './wrappers-outdated-info';

const arrayFilter = Array.prototype.filter;

export const TAG_TYPE   = 'tag';
export const CLASS_TYPE = 'class';
export const NAME_TYPE  = 'name';

export default class WrapperInternalInfo {
    constructor (nodeList, type, data) {
        this.nodeList            = nodeList;
        this.filteredNodeList    = null;
        this.lastUpdateTimestamp = null;
        this.data                = data;
        this.type                = type;

        this.refreshNodeList();
    }

    refreshNodeList () {
        if (!this.filteredNodeList || wrappersUpdateInfo.isWrapperOutdated(this)) {
            this.filteredNodeList = arrayFilter.call(this.nodeList, element => !isShadowUIElement(element));

            this.lastUpdateTimestamp = window.performance.now();
        }
    }
}
