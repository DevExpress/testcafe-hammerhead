export default class TagCache {
    constructor () {
        /*eslint-disable no-restricted-globals*/
        this._cache = Object.create(null);
        /*eslint-enable no-restricted-globals*/
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
