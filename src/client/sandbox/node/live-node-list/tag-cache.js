export default class TagCache {
    constructor () {
        this._cache = Object.create(null);
    }

    update (tagName) {
        tagName = tagName.toLowerCase();

        if (tagName === '*')
            return;

        this._cache[tagName] = true;
    }

    contains (tagName) {
        tagName = tagName.toLowerCase();

        return !!this._cache[tagName];
    }
}
