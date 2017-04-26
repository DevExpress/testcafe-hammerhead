export default class NodeListWrapper {
    constructor (nodeList, filterListFn, filterItemFn) {
        this.nodeList           = nodeList;
        this.filterListFn       = filterListFn;
        this.filterItemFn       = filterItemFn;
        this.filteredNodeList   = this.filterListFn(this.nodeList, filterItemFn);
        this.prevNodeListLength = this.nodeList.length;

        this.item = index => this.filteredNodeList[index];

        var wrapper = this;

        Object.defineProperty(this, 'length', {
            enumerable: false,
            get:        () => {
                NodeListWrapper._refreshNodeList.call(this);

                return wrapper.filteredNodeList.length;
            }
        });

        if (this.namedItem)
            this.namedItem = (...args) => this.nodeList.namedItem.apply(this.nodeList, args);

        NodeListWrapper._refreshNodeList.call(this);
    }

    static _refreshNodeList () {
        this.filteredNodeList = this.filterListFn(this.nodeList, this.filterItemFn);

        var wrapper = this;
        var i;

        for (i = 0; i < this.filteredNodeList.length; i++)
            Object.defineProperty(wrapper, i.toString(), { configurable: true, value: wrapper.filteredNodeList[i] });

        for (i = this.filteredNodeList.length; i < this.prevNodeListLength; i++)
            Object.defineProperty(wrapper, i.toString(), { configurable: true, value: void 0 });

        this.prevNodeListLength = this.nodeList.length;
    }
}
