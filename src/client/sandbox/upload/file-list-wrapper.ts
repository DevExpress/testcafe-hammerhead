import nativeMethods from '../native-methods';

export default class FileListWrapper {
    item: any;

    constructor (fileList) {
        nativeMethods.objectDefineProperty(this, 'length', {
            get: () => fileList.length
        });

        for (let i = 0; i < fileList.length; i++)
            this[i] = FileListWrapper._createFileWrapper(fileList[i]);

        this.item = index => this[index];
    }

    static _base64ToBlob (base64Data, fileName: string, mimeType: string, sliceSize?: number) {
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

        // NOTE: window.File in IE11 is not constructable.
        return !!nativeMethods.File
            ? new File(byteArrays, fileName, { type: mimeType })
            : new Blob(byteArrays, { type: mimeType });
    }

    static _createFileWrapper (fileInfo) {
        let wrapper = null;

        if (!window.Blob) {
            wrapper = {
                size: fileInfo.info.size,
                type: fileInfo.info.type
            };
        }
        else if (fileInfo.blob) {
            // NOTE: window.File in IE11 is not constructable.
            wrapper = !!nativeMethods.File
                ? new File([fileInfo.blob], fileInfo.info.name, {type: fileInfo.info.type})
                : wrapper = new Blob([fileInfo.blob], {type: fileInfo.info.type});
        }
        else
            wrapper = FileListWrapper._base64ToBlob(fileInfo.data, fileInfo.info.name, fileInfo.info.type);

        wrapper.name             = fileInfo.info.name;
        wrapper.lastModifiedDate = new Date(fileInfo.info.lastModifiedDate);
        wrapper.base64           = fileInfo.data;

        return wrapper;
    }
}

//@ts-ignore
if (window.FileList)
    FileListWrapper.prototype = FileList.prototype;
