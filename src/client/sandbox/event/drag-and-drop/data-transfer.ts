// NOTE: Although DataTransfer interface has a constructor, it is not possible to
// create a useful DataTransfer object from script, since DataTransfer objects have a
// processing and security model that is coordinated by the browser during drag-and-drops.
// So we have to create a mock for it to use it in drag-and-drop events
import { hasDataTransfer } from '../../../utils/feature-detection';
import nativeMethods from '../../native-methods';
import DataTransferItemList from './data-transfer-item-list';
import FileList from './file-list';
import DATA_STORE_MODE from './data-store-mode';
import DROP_EFFECT from './drop-effect';
import EFFECT_ALLOWED from './effect-allowed';

// https://html.spec.whatwg.org/multipage/interaction.html#datatransfer
export default class DataTransfer {
    setDragImage: any;
    getData: any;
    setData: any;
    clearData: any;

    constructor (dataStore) {
        let dropEffect    = DROP_EFFECT.none;
        let effectAllowed = EFFECT_ALLOWED.uninitialized;

        const itemList          = new DataTransferItemList(dataStore);
        const itemListInternals = itemList.getAndHideInternalMethods();
        const fileList          = new FileList();

        const emptyItemList      = new DataTransferItemList(dataStore);
        const emptyListInternals = emptyItemList.getAndHideInternalMethods();

        const getActualItemList = () => {
            return dataStore.mode === DATA_STORE_MODE.protected ? emptyItemList : itemList;
        };

        const getActualItemListInternals = () => {
            return dataStore.mode === DATA_STORE_MODE.protected ? emptyListInternals : itemListInternals;
        };

        nativeMethods.objectDefineProperty(this, 'dropEffect', {
            configurable: true,
            enumerable:   true,

            get: () => dropEffect,
            set: value => {
                if (DROP_EFFECT[value])
                    dropEffect = DROP_EFFECT[value];

                return value;
            },
        });

        nativeMethods.objectDefineProperty(this, 'effectAllowed', {
            configurable: true,
            enumerable:   true,

            get: () => effectAllowed,
            set: value => {
                if (EFFECT_ALLOWED[value])
                    effectAllowed = EFFECT_ALLOWED[value];

                return value;
            },
        });

        nativeMethods.objectDefineProperty(this, 'items', {
            configurable: true,
            enumerable:   true,

            get: getActualItemList,
        });

        nativeMethods.objectDefineProperty(this, 'types', {
            configurable: true,
            enumerable:   true,

            get: () => getActualItemListInternals().getTypes(),
        });

        nativeMethods.objectDefineProperty(this, 'files', {
            configurable: true,
            enumerable:   true,

            get: () => fileList,
        });

        this.setDragImage = function () {
            // do nothing
        };

        this.getData = function (format) {
            if (!arguments.length)
                throw new Error("Failed to execute 'getData' on 'DataTransfer': 1 argument required, but only 0 present.");

            format = format.toString().toLowerCase();

            return getActualItemListInternals().getItemData(format);
        };

        this.setData = function (format, data) {
            if (arguments.length < 2)
                throw new Error(`Failed to execute 'setData' on 'DataTransfer': 2 argument required, but only ${arguments.length} present.`);

            if (dataStore.mode !== DATA_STORE_MODE.readwrite)
                return;

            format = format.toString().toLowerCase();

            itemListInternals.addItem(data, format, true);
        };

        this.clearData = function (format) {
            if (dataStore.mode !== DATA_STORE_MODE.readwrite)
                return;

            if (format === void 0)
                // @ts-ignore
                itemList.clear();
            else
                itemListInternals.removeItem(format);
        };
    }
}

if (hasDataTransfer)
    DataTransfer.prototype = nativeMethods.DataTransfer.prototype;
