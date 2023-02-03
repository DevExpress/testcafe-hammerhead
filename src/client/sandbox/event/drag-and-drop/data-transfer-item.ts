import { isFunction } from '../../../utils/types';
import nativeMethods from '../../native-methods';
import DATA_TRANSFER_ITEM_KIND from './data-transfer-item-kind';

// https://html.spec.whatwg.org/multipage/interaction.html#datatransferitem
export default class DataTransferItem {
    constructor (kind, type, data) {
        nativeMethods.objectDefineProperty(this, 'kind', {
            enumerable: true,
            get:        () => kind,
        });

        nativeMethods.objectDefineProperty(this, 'type', {
            enumerable: true,
            get:        () => type,
        });

        nativeMethods.objectDefineProperty(this, 'getAsString', {
            configurable: true,
            enumerable:   true,

            get: () => {
                return function (callback) {
                    if (!arguments.length)
                        throw new Error("Failed to execute 'getAsString' on 'DataTransferItem': 1 argument required, but only 0 present.");

                    if (!isFunction(callback))
                        return;

                    if (kind !== DATA_TRANSFER_ITEM_KIND.string)
                        return;

                    nativeMethods.setTimeout.call(window, () => callback(data), 0);
                };
            },
        });

        nativeMethods.objectDefineProperty(this, 'getAsFile', {
            configurable: true,
            enumerable:   true,

            get: () => {
                return function () {
                    if (kind !== DATA_TRANSFER_ITEM_KIND.file)
                        return null;

                    return data;
                };
            },
        });
    }
}

if (nativeMethods.DataTransferItem)
    DataTransferItem.prototype = nativeMethods.DataTransferItem.prototype;
