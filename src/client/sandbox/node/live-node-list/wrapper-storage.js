import TagCache from './tag-cache';

const arrayFilter = Array.prototype.filter;

export default class LiveNodeListWrapperStorage {
    constructor () {
        this.wrappersWithRegularTag  = [];
        this.wrappersWithAsteriskTag = [];
        this.tagCache                = new TagCache();
    }

    static _markWrappersAsDirty (wrappers) {
        for (const wrapper of wrappers)
            wrapper._isDirty = true;
    }

    _getWrappersByTagName (tagName) {
        return arrayFilter.call(this.wrappersWithRegularTag, wrapper => wrapper._tagName === tagName);
    }

    add (wrapper) {
        const tagName = wrapper._tagName;

        this.tagCache.update(tagName);

        if (tagName === '*')
            this.wrappersWithAsteriskTag.push(wrapper);
        else
            this.wrappersWithRegularTag.push(wrapper);
    }

    markAllWrappersAsDirty () {
        LiveNodeListWrapperStorage._markWrappersAsDirty(this.wrappersWithAsteriskTag);
        LiveNodeListWrapperStorage._markWrappersAsDirty(this.wrappersWithRegularTag);
    }

    markWrappersWithSpecifiedTagNameAsDirty (tagName) {
        LiveNodeListWrapperStorage._markWrappersAsDirty(this.wrappersWithAsteriskTag);

        if (!this.tagCache.contains(tagName))
            return;

        const wrappersWithSpecifiedTag = this._getWrappersByTagName(tagName);

        LiveNodeListWrapperStorage._markWrappersAsDirty(wrappersWithSpecifiedTag);
    }

    notifyAllWrappersAboutDOMContentLoadedEvent () {
        for (const wrapperWithAsteriskTag of this.wrappersWithAsteriskTag)
            wrapperWithAsteriskTag._domContentLoadedEventRaised = true;

        for (const wrapperWithRegularTag of this.wrappersWithRegularTag)
            wrapperWithRegularTag._domContentLoadedEventRaised = true;
    }
}
