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

function processFormat (format) {
    if (format === 'text')
        return 'text/plain';

    if (format === 'url')
        return 'text/uri-list';

    return format;
}

// https://html.spec.whatwg.org/multipage/interaction.html#datatransferitemlist
export default class DataTransferItemList {
    constructor (dataStore) {
        // Internals
        var items     = [];
        var itemsData = [];

        var getTypes = () => {
            var res = [];

            for (var i = 0; i < items.length; i++)
                res.push(items[i].type);

            return res;
        };

        var updateIndexes = () => {
            var idx = 0;

            while (items[idx] !== void 0 || this[idx] !== void 0) {
                var item = items[idx];

                Object.defineProperty(this, idx, {
                    enumerable:   item !== void 0,
                    configurable: true,
                    value:        item
                });

                idx++;
            }
        };

        var getItemData = format => {
            var convertToUrl = false;

            format = processFormat(format);

            if (format === 'url')
                convertToUrl = true;

            var item = '';

            for (var i = 0; i < items.length; i++) {
                if (items[i].type === format)
                    item = itemsData[i];
            }

            if (convertToUrl && item)
                item = parseTextUriList(item)[0];

            return item;
        };

        var removeItem = format => {
            format = processFormat(format);

            for (var i = 0; i < items.length; i++) {
                if (items[i].type === format) {
                    items.splice(i, 1);
                    itemsData.splice(i, 1);
                    break;
                }
            }

            updateIndexes();
        };

        var addItem = (data, type, allowReplace) => {
            var newItem = null;

            if (typeof data === 'string') {
                var typeLowerCase = type.toString().toLowerCase();
                var itemData      = getItemData(typeLowerCase);

                if (!allowReplace && itemData)
                    throw new Error(`Failed to execute 'add' on 'DataTransferItemList': An item already exists for type '${typeLowerCase}'.`);

                if (itemData)
                    removeItem(typeLowerCase);

                newItem = new DataTransferItem(DATA_TRANSFER_ITEM_KIND.string, processFormat(type), data);
            }
            else
                newItem = new DataTransferItem(DATA_TRANSFER_ITEM_KIND.file, null, data);

            items.push(newItem);
            itemsData.push(data);
            updateIndexes();

            return newItem;
        };

        // Internal API
        this.getAndHideInternalMethods = () => {
            var res = { getTypes, getItemData, removeItem, addItem };

            this.getAndHideInternalMethods = void 0;

            return res;
        };

        // API
        Object.defineProperty(this, 'length', {
            enumerable: true,

            get: () => items.length
        });

        Object.defineProperty(this, 'remove', {
            configurable: true,
            enumerable:   true,

            get: () => {
                return function (idx) {
                    if (dataStore.mode !== DATA_STORE_MODE.readwrite)
                        return;

                    items.splice(idx, 1);
                    itemsData.splice(idx, 1);
                    updateIndexes();
                };
            }
        });

        Object.defineProperty(this, 'clear', {
            configurable: true,
            enumerable:   true,

            get: () => {
                return function () {
                    if (dataStore.mode !== DATA_STORE_MODE.readwrite)
                        return;

                    items     = [];
                    itemsData = [];
                    updateIndexes();
                };
            }
        });

        Object.defineProperty(this, 'add', {
            configurable: true,
            enumerable:   true,

            get: () => {
                return function (data, type) {
                    if (!arguments.length)
                        throw new Error("Failed to execute 'add' on 'DataTransferItemList': 1 argument required, but only 0 present.");

                    if (arguments.length === 1 && typeof data === 'string')
                        throw new Error("Failed to execute 'add' on 'DataTransferItemList': parameter 1 is not of type 'File'.");

                    if (dataStore.mode !== DATA_STORE_MODE.readwrite)
                        return void 0;

                    return addItem(data, type, false);
                };
            }
        });
    }
}

if (window.DataTransferItemList)
    DataTransferItemList.prototype = window.DataTransferItemList.prototype;
