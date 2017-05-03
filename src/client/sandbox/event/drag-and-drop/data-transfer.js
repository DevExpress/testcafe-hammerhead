// NOTE: Although DataTransfer interface has a constructor, it is not possible to
// create a useful DataTransfer object from script, since DataTransfer objects have a
// processing and security model that is coordinated by the browser during drag-and-drops.
// So we have to create a mock for it to use it in drag-and-drop events
import { setTimeout } from '../../native-methods';

const DROP_EFFECT = {
    none: 'none',
    copy: 'copy',
    link: 'link',
    move: 'move'
};

const EFFECT_ALLOWED = {
    uninitialized: 'uninitialized',
    none:          'none',
    copy:          'copy',
    copyLink:      'copyLink',
    copyMove:      'copyMove',
    link:          'link',
    linkMove:      'linkMove',
    move:          'move',
    all:           'all'
};

const DATA_TRANSFER_ITEM_KIND = {
    string: 'string',
    file:   'file'
};

const DATA_STORE_MODE = {
    readwrite: 'readwrite',
    readonly:  'readonly',
    protected: 'protected'
};

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


class DataStore {
    constructor () {
        this.mode = DATA_STORE_MODE.readwrite;
    }
}

// https://html.spec.whatwg.org/multipage/interaction.html#datatransferitem
class DataTransferItem {
    constructor (kind, type, data) {
        this._kind = kind;
        this._type = type;
        this._data = data;
    }

    get kind () {
        return this._kind;
    }

    get type () {
        return this._type;
    }

    getAsString (callback) {
        if (!arguments.length)
            throw new Error("Failed to execute 'getAsString' on 'DataTransferItem': 1 argument required, but only 0 present.");

        if (typeof callback !== 'function')
            return;

        if (this.kind !== DATA_TRANSFER_ITEM_KIND.string)
            return;

        setTimeout(() => callback(this._data), 0);
    }

    getAsFile () {
        if (this.kind !== DATA_TRANSFER_ITEM_KIND.file)
            return null;

        return this._data;
    }
}

// https://html.spec.whatwg.org/multipage/interaction.html#datatransferitemlist
class DataTransferItemList {
    constructor (dataStore) {
        this._items     = [];
        this._dataStore = dataStore;
    }

    get _types () {
        var res = [];

        for (var i = 0; i < this._items.length; i++)
            res.push(this._items[i].type);

        return res;
    }

    _getItem (format) {
        var convertToUrl = false;

        if (format === 'text')
            format = 'text/plain';

        if (format === 'url') {
            format       = 'text/uri-list';
            convertToUrl = true;
        }

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
        if (format === 'text')
            format = 'text/plain';

        if (format === 'url')
            format = 'text/uri-list';

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

            newItem = new DataTransferItem(DATA_TRANSFER_ITEM_KIND.string, type, data);
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

// https://html.spec.whatwg.org/multipage/interaction.html#datatransfer
export default class DataTransfer {
    constructor () {
        this._dropEffect    = DROP_EFFECT.none;
        this._effectAllowed = EFFECT_ALLOWED.uninitialized;
        this._dataStore     = new DataStore();

        this.itemList = new DataTransferItemList(this._dataStore);
    }

    _setReadOnlyMode () {
        this._dataStore.mode = DATA_STORE_MODE.readonly;
    }

    _setProtectedMode () {
        this._dataStore.mode = DATA_STORE_MODE.protected;
        this.itemList        = new DataTransferItemList(this._dataStore);
    }

    get dropEffect () {
        return this._dropEffect;
    }

    set dropEffect (value) {
        if (DROP_EFFECT[value])
            this._dropEffect = DROP_EFFECT[value];

        return value;
    }

    get effectAllowed () {
        return this._effectAllowed;
    }

    set effectAllowed (value) {
        if (EFFECT_ALLOWED[value])
            this._effectAllowed = EFFECT_ALLOWED[value];

        return value;
    }

    get items () {
        return this.itemList;
    }

    setDragImage () {
        // do nothing
    }

    get types () {
        return this.itemList._types;
    }

    getData (format) {
        if (!arguments.length)
            throw new Error("Failed to execute 'getData' on 'DataTransfer': 1 argument required, but only 0 present.");

        format = format.toString().toLowerCase();

        return this.itemList._getItem(format);
    }

    setData (format, data) {
        if (arguments.length < 2)
            throw new Error(`Failed to execute 'setData' on 'DataTransfer': 2 argument required, but only ${arguments.length} present.`);

        if (this._dataStore.mode !== DATA_STORE_MODE.readwrite)
            return;

        format = format.toString().toLowerCase();

        this.itemList._addItem(data, format, true);
    }

    clearData (format) {
        if (this._dataStore.mode !== DATA_STORE_MODE.readwrite)
            return;

        if (format === void 0)
            this.itemList.clear();
        else
            this.itemList._removeItem(format);
    }

    get files () {
        return [];
    }
}
