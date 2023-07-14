import nativeMethods from '../native-methods';

export default class FileListWrapper {
    item: any;

    constructor (fileList) {
        nativeMethods.objectDefineProperty(this, 'length', {
            get: () => fileList.length,
        });

        for (let i = 0; i < fileList.length; i++)
            this[i] = FileListWrapper._createFileWrapper(fileList[i]);

        this.item = index => this[index];
    }

    static _base64ToBlob (base64Data, fileInfo, sliceSize?: number) {
        const mimeType = fileInfo.info.type || '';

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

        return new nativeMethods.File(byteArrays, fileInfo.info.name, { type: mimeType, lastModified: fileInfo.info.lastModified });
    }

    static _createFileWrapper (fileInfo) {
        let wrapper = null;

        if (!window.Blob) {
            wrapper = {
                size: fileInfo.info.size,
                type: fileInfo.info.type,
            };
        }
        else if (fileInfo.blob)
            wrapper = new nativeMethods.File([fileInfo.blob], fileInfo.info.name, { type: fileInfo.info.type, lastModified: fileInfo.info.lastModified });
        else
            wrapper = FileListWrapper._base64ToBlob(fileInfo.data, fileInfo);

        wrapper.name = fileInfo.info.name;

        if (fileInfo.info.lastModifiedDate)
            wrapper.lastModifiedDate = fileInfo.info.lastModifiedDate;

        wrapper.base64 = fileInfo.data;

        return wrapper;
    }
}

//@ts-ignore
if (window.FileList)
    FileListWrapper.prototype = FileList.prototype;
