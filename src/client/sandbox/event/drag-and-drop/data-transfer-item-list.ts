import nativeMethods from '../../native-methods';
import DataTransferItem from './data-transfer-item';
import DATA_STORE_MODE from './data-store-mode';
import DATA_TRANSFER_ITEM_KIND from './data-transfer-item-kind';

function parseTextUriList (textUriList) {
    textUriList = textUriList.replace(/\r\n$/, '');

    const res = [];

    if (textUriList === '')
        return res;

    textUriList = textUriList.split(/\r\n/);

    for (const textUri of textUriList) {
        if (textUri !== '#')
            res.push(textUri);
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
    getAndHideInternalMethods: any;

    constructor (dataStore) {
        // Internals
        let items     = [];
        let itemsData = [];

        const getTypes = () => {
            const res = [];

            for (const item of items)
                res.push(item.type);

            return res;
        };

        const updateIndexes = () => {
            let idx = 0;

            while (items[idx] !== void 0 || this[idx] !== void 0) {
                const item = items[idx];

                nativeMethods.objectDefineProperty(this, idx, {
                    enumerable:   item !== void 0,
                    configurable: true,
                    value:        item,
                });

                idx++;
            }
        };

        const getItemData = format => {
            let convertToUrl = false;

            format = processFormat(format);

            if (format === 'url')
                convertToUrl = true;

            let item = '';

            for (let i = 0; i < items.length; i++) {
                if (items[i].type === format)
                    item = itemsData[i];
            }

            if (convertToUrl && item)
                item = parseTextUriList(item)[0];

            return item;
        };

        const removeItem = format => {
            format = processFormat(format);

            for (let i = 0; i < items.length; i++) {
                if (items[i].type === format) {
                    items.splice(i, 1);
                    itemsData.splice(i, 1);
                    break;
                }
            }

            updateIndexes();
        };

        const addItem = (data, type, allowReplace) => {
            let newItem = null;

            if (typeof data === 'string') {
                const typeLowerCase = type.toString().toLowerCase();
                const itemData      = getItemData(typeLowerCase);

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
            const res = { getTypes, getItemData, removeItem, addItem };

            delete this.getAndHideInternalMethods;

            return res;
        };

        // API
        nativeMethods.objectDefineProperty(this, 'length', {
            enumerable: true,

            get: () => items.length,
        });

        nativeMethods.objectDefineProperty(this, 'remove', {
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
            },
        });

        nativeMethods.objectDefineProperty(this, 'clear', {
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
            },
        });

        nativeMethods.objectDefineProperty(this, 'add', {
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
            },
        });
    }
}

if (nativeMethods.DataTransferItemList)
    DataTransferItemList.prototype = nativeMethods.DataTransferItemList.prototype;
