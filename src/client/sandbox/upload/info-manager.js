import COMMAND from '../../../session/command';
import FileListWrapper from './file-list-wrapper';
import nativeMethods from '../native-methods';
import transport from '../../transport';
import settings from '../../settings';
import * as Browser from '../../utils/browser';
import * as HiddenInfo from './hidden-info';
import SHADOW_UI_CLASSNAME from '../../../shadow-ui/class-name';
import Promise from 'pinkie';
import JSON from '../../json';

// NOTE: https://html.spec.whatwg.org/multipage/forms.html#fakepath-srsly.
const FAKE_PATH_STRING = 'C:\\fakepath\\';

const UPLOAD_IFRAME_FOR_IE9_ID = 'uploadIframeForIE9' + SHADOW_UI_CLASSNAME.postfix;

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

    static _getUploadIframeForIE9 () {
        let uploadIframe = nativeMethods.querySelector.call(document, '#' + UPLOAD_IFRAME_FOR_IE9_ID);

        if (!uploadIframe) {
            uploadIframe = nativeMethods.createElement.call(document, 'iframe');

            nativeMethods.setAttribute.call(uploadIframe, 'id', UPLOAD_IFRAME_FOR_IE9_ID);
            nativeMethods.setAttribute.call(uploadIframe, 'name', UPLOAD_IFRAME_FOR_IE9_ID);
            uploadIframe.style.display = 'none';

            nativeMethods.appendChild.call(this.shadowUI.getRoot(), uploadIframe);
        }

        return uploadIframe;
    }

    _loadFileListDataForIE9 (input) {
        return Promise(resolve => {
            const form = input.form;

            if (form && input.value) {
                const sourceTarget       = form.target;
                const sourceActionString = form.action;
                const sourceMethod       = form.method;
                const uploadIframe       = UploadInfoManager._getUploadIframeForIE9();

                const loadHandler = () => {
                    const fileListWrapper = new FileListWrapper([JSON.parse(uploadIframe.contentWindow.document.body.innerHTML)]);

                    uploadIframe.removeEventListener('load', loadHandler);
                    resolve(fileListWrapper);
                };

                uploadIframe.addEventListener('load', loadHandler);

                form.action = settings.get().ie9FileReaderShimUrl + '?input-name=' + input.name + '&filename=' +
                              input.value;
                form.target = UPLOAD_IFRAME_FOR_IE9_ID;
                form.method = 'post';

                nativeMethods.formSubmit.call(form);

                form.action = sourceActionString;
                form.target = sourceTarget;
                form.method = sourceMethod;
            }
            else
                resolve(new FileListWrapper([]));
        });
    }

    static formatValue (fileNames) {
        let value = '';

        fileNames = typeof fileNames === 'string' ? [fileNames] : fileNames;

        if (fileNames && fileNames.length) {
            if (Browser.isWebKit)
                value = FAKE_PATH_STRING + fileNames[0].split('/').pop();
            else if (Browser.isIE9 || Browser.isIE10) {
                const filePaths = [];

                for (const fileName of fileNames)
                    filePaths.push(FAKE_PATH_STRING + fileName.split('/').pop());

                value = filePaths.join(', ');
            }
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
            inputInfo.files = new FileListWrapper([]);
            inputInfo.value = '';

            return HiddenInfo.removeInputInfo(input);
        }

        return null;
    }

    getFiles (input) {
        const inputInfo = this.getUploadInfo(input);

        return inputInfo ? inputInfo.files : new FileListWrapper([]);
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

        return inputInfo ? inputInfo.value : '';
    }

    loadFileListData (input, fileList) {
        /*eslint-disable no-else-return */
        if (Browser.isIE9)
            return this._loadFileListDataForIE9(input);
        else if (!fileList.length)
            return Promise.resolve(new FileListWrapper([]));
        else {
            return new Promise(resolve => {
                let index         = 0;
                const fileReader  = new FileReader();
                let file          = fileList[index];
                const readedFiles = [];

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
        /*eslint-enable no-else-return */
    }

    setUploadInfo (input, fileList, value) {
        let inputInfo = this.getUploadInfo(input);

        if (!inputInfo) {
            inputInfo = { input: input };
            this.uploadInfo.push(inputInfo);
        }

        inputInfo.files = fileList;
        inputInfo.value = value;

        HiddenInfo.addInputInfo(input, fileList, value);
    }
}
