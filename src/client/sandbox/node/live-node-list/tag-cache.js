export default class TagCache {
    constructor () {
        this._cache = [];
    }

    update (tagName) {
        tagName = tagName.toLowerCase();

        if (tagName === '*')
            return;

        if (this._cache.indexOf(tagName) === -1)
            this._cache.push(tagName);
    }

    contains (tagName) {
        tagName = tagName.toLowerCase();

        return this._cache.indexOf(tagName) !== -1;
    }
}
