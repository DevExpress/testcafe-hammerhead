import COMMAND from '../../../session/command';
import FileListWrapper from './file-list-wrapper';
import * as HiddenInfo from './hidden-info';
import Promise from 'pinkie';
import { GetUploadedFilesServiceMessage, StoreUploadedFilesServiceMessage } from '../../../typings/upload';
import Transport from '../../transport';
import nativeMethods from '../native-methods';
import { isNumber } from '../../utils/types';

// NOTE: https://html.spec.whatwg.org/multipage/forms.html#fakepath-srsly.
const FAKE_PATH_STRING = 'C:\\fakepath\\';

export default class UploadInfoManager {
    uploadInfo: any;

    constructor (private readonly _transport: Transport) {
        this.uploadInfo = [];
    }

    static _getFileListData (fileList) {
        const data = [];

        for (const file of fileList)
            data.push(file.base64);

        return data;
    }

    static formatValue (fileNames: string | string[]) {
        let value = '';

        fileNames = typeof fileNames === 'string' ? [fileNames] : fileNames;

        if (fileNames && fileNames.length) {
            const fileName = fileNames[0].replace(/\\/g, '/');

            value = FAKE_PATH_STRING + fileName.split('/').pop();
        }

        return value;
    }

    static getFileNames (fileList, value) {
        const result = [];

        if (fileList) {
            for (const file of fileList)
                result.push(file.name);
        }
        else if (value.lastIndexOf('\\') !== -1)
            result.push(value.substr(value.lastIndexOf('\\') + 1));

        return result;
    }

    loadFilesInfoFromServer (filePaths: string | string[]) {
        return this._transport.asyncServiceMsg({
            cmd:       COMMAND.getUploadedFiles,
            filePaths: typeof filePaths === 'string' ? [filePaths] : filePaths,
        } as GetUploadedFilesServiceMessage);
    }

    static prepareFileListWrapper (filesInfo) {
        const errs           = [];
        const validFilesInfo = [];

        for (const fileInfo of filesInfo) {
            if (fileInfo.err)
                errs.push(fileInfo);
            else
                validFilesInfo.push(fileInfo);
        }

        return {
            errs:     errs,
            fileList: new FileListWrapper(validFilesInfo),
        };
    }

    sendFilesInfoToServer (fileList, fileNames) {
        return this._transport.asyncServiceMsg({
            cmd:       COMMAND.uploadFiles,
            data:      UploadInfoManager._getFileListData(fileList),
            fileNames: fileNames,
        } as StoreUploadedFilesServiceMessage);
    }

    clearUploadInfo (input) {
        const inputInfo = this.getUploadInfo(input);

        if (inputInfo) {
            /*eslint-disable no-restricted-properties*/
            inputInfo.files = new FileListWrapper([]);
            inputInfo.value = '';
            /*eslint-enable no-restricted-properties*/

            return HiddenInfo.removeInputInfo(input);
        }

        return null;
    }

    getFiles (input) {
        const inputInfo = this.getUploadInfo(input);

        // eslint-disable-next-line no-restricted-properties
        return inputInfo ? inputInfo.files : new FileListWrapper([]);
    }

    getUploadInfo (input) {
        for (const uploadInfoItem of this.uploadInfo) {
            if (uploadInfoItem.input === input)
                return uploadInfoItem;
        }

        return null;
    }

    getValue (input: HTMLInputElement) {
        const inputInfo = this.getUploadInfo(input);

        // eslint-disable-next-line no-restricted-properties
        return inputInfo ? inputInfo.value : '';
    }

    loadFileListData (_input, fileList) {
        if (!fileList.length)
            return Promise.resolve(new FileListWrapper([]));

        return new Promise(resolve => {
            const fileReader  = new FileReader();
            const readedFiles = [];
            let index         = 0;
            let file          = fileList[index];

            fileReader.addEventListener('load', (e: ProgressEvent<FileReader>) => {
                const info: any = {
                    type: file.type,
                    name: file.name,
                };

                if (isNumber(file.lastModified))
                    info.lastModified = file.lastModified;

                if (file.lastModifiedDate)
                    info.lastModifiedDate = file.lastModifiedDate;

                const dataUrl = nativeMethods.eventTargetGetter.call(e).result as string;

                readedFiles.push({
                    data: dataUrl.substr(dataUrl.indexOf(',') + 1),
                    blob: file.slice(0, file.size),
                    info,
                });

                if (fileList[++index]) {
                    file = fileList[index];
                    fileReader.readAsDataURL(file);
                }
                else
                    resolve(new FileListWrapper(readedFiles));
            });

            fileReader.readAsDataURL(file);
        });
    }

    setUploadInfo (input, fileList, value) {
        let inputInfo = this.getUploadInfo(input);

        if (!inputInfo) {
            inputInfo = { input: input };
            this.uploadInfo.push(inputInfo);
        }

        /*eslint-disable no-restricted-properties*/
        inputInfo.files = fileList;
        inputInfo.value = value;
        /*eslint-enable no-restricted-properties*/

        HiddenInfo.addInputInfo(input, fileList, value);
    }
}
