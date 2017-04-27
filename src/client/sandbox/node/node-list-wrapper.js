export default class NodeListWrapper {
    constructor (nodeList, filterListFn, filterItemFn) {
        Object.defineProperty(this, 'item', {
            enumerable:   true,
            configurable: false,
            value:        index => this._filteredNodeList[index]
        });

        Object.defineProperty(this, 'length', {
            enumerable:   true,
            configurable: false,
            get:          () => {
                NodeListWrapper._refreshNodeList.call(this);

                return this._filteredNodeList.length;
            }
        });

        Object.defineProperty(this, '_nodeList', {
            enumerable:   false,
            configurable: false,
            value:        nodeList
        });

        Object.defineProperty(this, '_filterListFn', {
            enumerable:   false,
            configurable: false,
            value:        filterListFn
        });

        Object.defineProperty(this, '_filterItemFn', {
            enumerable:   false,
            configurable: false,
            value:        filterItemFn
        });

        Object.defineProperty(this, '_filteredNodeList', {
            enumerable:   false,
            configurable: false,
            get:          () => this._filterListFn(this._nodeList, this._filterItemFn)
        });


        Object.defineProperty(this, '_prevNodeListLength', {
            enumerable:   false,
            configurable: false,
            value:        this._nodeList.length
        });


        if (this.namedItem) {
            Object.defineProperty(this, 'namedItem', {
                enumerable:   true,
                configurable: false,
                value:        (...args) => this._nodeList.namedItem.apply(this._nodeList, args)
            });
        }

        NodeListWrapper._refreshNodeList.call(this);
    }

    static _refreshNodeList () {
        this._filteredNodeList = this._filterListFn(this._nodeList, this._filterItemFn);

        var i;

        for (i = 0; i < this._filteredNodeList.length; i++) {
            Object.defineProperty(this, i, {
                enumerable:   true,
                configurable: true,
                value:        this._filteredNodeList[i]
            });
        }

        for (i = this._filteredNodeList.length; i < this._prevNodeListLength; i++) {
            Object.defineProperty(this, i, {
                enumerable:   false,
                configurable: true,
                value:        void 0
            });
        }

        this._prevNodeListLength = this._nodeList.length;
    }
}
