import DataTransferItem from './data-transfer-item';
import DATA_STORE_MODE from './data-store-mode';
import DATA_TRANSFER_ITEM_KIND from './data-transfer-item-kind';

function parseTextUriList (textUriList) {
    textUriList = textUriList.replace(/\r\n$/, '');

    var res = [];

    if (textUriList === '')
        return res;

    textUriList = textUriList.split(/\r\n/);

    for (var i = 0; i < textUriList.length; i++) {
        if (textUriList[0] !== '#')
            res.push(textUriList[i]);
    }

    return res;
}

// https://html.spec.whatwg.org/multipage/interaction.html#datatransferitemlist
export default class DataTransferItemList {
    constructor (dataStore) {
        this._items     = [];
        this._dataStore = dataStore;
    }

    static processFormat (format) {
        if (format === 'text')
            return 'text/plain';

        if (format === 'url')
            return 'text/uri-list';

        return format;
    }

    get _types () {
        var res = [];

        for (var i = 0; i < this._items.length; i++)
            res.push(this._items[i].type);

        return res;
    }

    _getItem (format) {
        var convertToUrl = false;

        format = DataTransferItemList.processFormat(format);

        if (format === 'url')
            convertToUrl = true;

        var item = '';

        for (var i = 0; i < this._items.length; i++) {
            if (this._items[i].type === format)
                item = this._items[i]._data;
        }

        if (convertToUrl && item)
            item = parseTextUriList(item)[0];

        return item;
    }

    _removeItem (format) {
        format = DataTransferItemList.processFormat(format);

        for (var i = 0; i < this._items.length; i++) {
            if (this._items[i].type === format) {
                this._items.splice(i, 1);
                break;
            }
        }

        this._updateIndexes();
    }

    _updateIndexes () {
        var idx = 0;

        while (this._items[idx] !== void 0 || this[idx] !== void 0) {
            this[idx] = this._items[idx];
            idx++;
        }
    }

    _addItem (data, type, allowReplace) {
        var newItem = null;

        if (typeof data === 'string') {
            var typeLowerCase = type.toString().toLowerCase();
            var item          = this._getItem(typeLowerCase);

            if (!allowReplace && item)
                throw new Error(`Failed to execute 'add' on 'DataTransferItemList': An item already exists for type '${typeLowerCase}'.`);

            if (item)
                this._removeItem(typeLowerCase);

            newItem = new DataTransferItem(DATA_TRANSFER_ITEM_KIND.string, DataTransferItemList.processFormat(type), data);
        }
        else
            newItem = new DataTransferItem(DATA_TRANSFER_ITEM_KIND.file, null, data);

        this._items.push(newItem);
        this._updateIndexes();

        return newItem;
    }


    get length () {
        return this._items.length;
    }

    remove (idx) {
        if (this._dataStore.mode !== DATA_STORE_MODE.readwrite)
            return;

        this._items.splice(idx, 1);
        this._updateIndexes();
    }

    clear () {
        if (this._dataStore.mode !== DATA_STORE_MODE.readwrite)
            return;

        this._items = [];
        this._updateIndexes();
    }

    add (data, type) {
        if (!arguments.length)
            throw new Error("Failed to execute 'add' on 'DataTransferItemList': 1 argument required, but only 0 present.");

        if (arguments.length === 1 && typeof data === 'string')
            throw new Error("Failed to execute 'add' on 'DataTransferItemList': parameter 1 is not of type 'File'.");

        if (this._dataStore.mode !== DATA_STORE_MODE.readwrite)
            return void 0;

        return this._addItem(data, type, false);
    }
}
