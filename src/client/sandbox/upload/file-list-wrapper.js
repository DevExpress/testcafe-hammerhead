import nativeMethods from '../native-methods';

export default class FileListWrapper {
    constructor (fileList) {
        nativeMethods.objectDefineProperty.call(window, this, 'length', {
            get: () => fileList.length
        });

        for (let i = 0; i < fileList.length; i++)
            this[i] = FileListWrapper._createFileWrapper(fileList[i]);
    }

    item (index) {
        return this[index];
    }

    static _base64ToBlob (base64Data, mimeType, sliceSize) {
        mimeType  = mimeType || '';
        sliceSize = sliceSize || 512;

        const byteCharacters = atob(base64Data);
        const byteArrays     = [];

        for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
            const slice       = byteCharacters.slice(offset, offset + sliceSize);
            const byteNumbers = new Array(slice.length);

            for (let i = 0; i < slice.length; i++)
                byteNumbers[i] = slice.charCodeAt(i);

            byteArrays.push(new Uint8Array(byteNumbers));
        }

        return new Blob(byteArrays, { type: mimeType });
    }

    static _createFileWrapper (fileInfo) {
        let wrapper = null;

        if (!window.Blob) {
            wrapper = {
                size: fileInfo.info.size,
                type: fileInfo.info.type
            };
        }
        else if (fileInfo.blob)
            wrapper = new Blob([fileInfo.blob], { type: fileInfo.info.type });
        else
            wrapper = FileListWrapper._base64ToBlob(fileInfo.data, fileInfo.info.type);

        wrapper.name             = fileInfo.info.name;
        wrapper.lastModifiedDate = new Date(fileInfo.info.lastModifiedDate);
        wrapper.base64           = fileInfo.data;

        return wrapper;
    }
}

if (window.FileList)
    FileListWrapper.prototype = FileList.prototype;
