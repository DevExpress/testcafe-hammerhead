import COMMAND from '../../../session/command';
import FileListWrapper from './file-list-wrapper';
import transport from '../../transport';
import * as Browser from '../../utils/browser';
import * as HiddenInfo from './hidden-info';
import Promise from 'pinkie';

// NOTE: https://html.spec.whatwg.org/multipage/forms.html#fakepath-srsly.
const FAKE_PATH_STRING = 'C:\\fakepath\\';

export default class UploadInfoManager {
    constructor (shadowUI) {
        this.shadowUI   = shadowUI;
        this.uploadInfo = [];
    }

    static _getFileListData (fileList) {
        const data = [];

        for (const file of fileList)
            data.push(file.base64);

        return data;
    }

    static formatValue (fileNames) {
        let value = '';

        fileNames = typeof fileNames === 'string' ? [fileNames] : fileNames;

        if (fileNames && fileNames.length) {
            if (Browser.isWebKit)
                value = FAKE_PATH_STRING + fileNames[0].split('/').pop();
            else
                return fileNames[0].split('/').pop();
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

    static loadFilesInfoFromServer (filePaths) {
        return transport.asyncServiceMsg({
            cmd:       COMMAND.getUploadedFiles,
            filePaths: typeof filePaths === 'string' ? [filePaths] : filePaths
        });
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
            fileList: new FileListWrapper(validFilesInfo)
        };
    }

    static sendFilesInfoToServer (fileList, fileNames) {
        return transport.asyncServiceMsg({
            cmd:       COMMAND.uploadFiles,
            data:      UploadInfoManager._getFileListData(fileList),
            fileNames: fileNames
        });
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

        /*eslint-disable no-restricted-properties*/
        return inputInfo ? inputInfo.files : new FileListWrapper([]);
        /*eslint-enable no-restricted-properties*/
    }

    getUploadInfo (input) {
        for (const uploadInfoItem of this.uploadInfo) {
            if (uploadInfoItem.input === input)
                return uploadInfoItem;
        }

        return null;
    }

    getValue (input) {
        const inputInfo = this.getUploadInfo(input);

        /*eslint-disable no-restricted-properties*/
        return inputInfo ? inputInfo.value : '';
        /*eslint-enable no-restricted-properties*/
    }

    loadFileListData (input, fileList) {
        if (!fileList.length)
            return Promise.resolve(new FileListWrapper([]));

        return new Promise(resolve => {
            const fileReader  = new FileReader();
            const readedFiles = [];
            let index         = 0;
            let file          = fileList[index];

            fileReader.addEventListener('load', e => {
                readedFiles.push({
                    data: e.target.result.substr(e.target.result.indexOf(',') + 1),
                    blob: file.slice(0, file.size),
                    info: {
                        type:             file.type,
                        name:             file.name,
                        lastModifiedDate: file.lastModifiedDate
                    }
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
