export default class NodeListWrapper {
    constructor (nodeList, filterListFn, filterItemFn, isLiveCollection) {
        Object.defineProperty(this, 'item', {
            enumerable: true,
            value:      index => this._filteredNodeList[index]
        });

        Object.defineProperty(this, 'length', {
            enumerable: true,
            get:        () => {
                if (isLiveCollection)
                    NodeListWrapper._refreshNodeList.call(this);

                return this._filteredNodeList.length;
            }
        });

        Object.defineProperty(this, '_nodeList', {
            value: nodeList
        });

        Object.defineProperty(this, '_filterListFn', {
            value: filterListFn
        });

        Object.defineProperty(this, '_filterItemFn', {
            value: filterItemFn
        });

        Object.defineProperty(this, '_filteredNodeList', {
            get: () => this._filterListFn(this._nodeList, this._filterItemFn)
        });


        Object.defineProperty(this, '_prevNodeListLength', {
            value: this._nodeList.length
        });


        if (this.namedItem) {
            Object.defineProperty(this, 'namedItem', {
                enumerable: true,
                value:      (...args) => this._nodeList.namedItem.apply(this._nodeList, args)
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
                configurable: true,
                value:        void 0
            });
        }

        this._prevNodeListLength = this._nodeList.length;
    }
}
