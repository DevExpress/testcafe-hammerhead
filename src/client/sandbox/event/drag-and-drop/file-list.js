// https://w3c.github.io/FileAPI/#filelist-section
// NOTE: we have limited support for FileList only for drag and drop DataTransfer purposes
import nativeMethods from '../../native-methods';

export default class FileList {
    constructor () {
        Object.defineProperty(this, 'length', {
            enumerable: true,

            get: () => 0
        });

        Object.defineProperty(this, 'item', {
            enumerable: true,

            get: () => {
                return function () {
                    return void 0;
                };
            }
        });
    }
}

if (nativeMethods.FileList)
    FileList.prototype = nativeMethods.FileList.prototype;
