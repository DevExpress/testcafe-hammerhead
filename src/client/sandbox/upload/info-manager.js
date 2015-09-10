/*global atob, Blob, FileReader*/
import * as Browser from '../../utils/browser';
import * as HiddenInfo from './hidden-info';
import NativeMethods from '../native-methods';
import ServiceCommands from '../../../service-msg-cmd';
import { SHADOW_UI_CLASSNAME_POSTFIX } from '../../../const';
import Transport from '../../transport';
import Settings from '../../settings';
import FileListWrapper from './file-list-wrapper';

export default class UploadInfoManager {
    constructor () {
        this.FAKE_PATH_STRING         = 'C:\\fakepath\\';
        this.UPLOAD_IFRAME_FOR_IE9_ID = 'uploadIFrameForIE9' + SHADOW_UI_CLASSNAME_POSTFIX;

        this.uploadInfo = [];
    }

    _getFileListData (fileList) {
        var data = [];

        for (var i = 0; i < fileList.length; i++)
            data.push(fileList[i].base64);

        return data;
    }

    _getUploadIFrameForIE9 () {
        var uploadIFrame = NativeMethods.querySelector.call(document, '#' + this.UPLOAD_IFRAME_FOR_IE9_ID);

        if (!uploadIFrame) {
            uploadIFrame               = NativeMethods.createElement.call(document, 'iframe');

            NativeMethods.setAttribute.call(uploadIFrame, 'id', this.UPLOAD_IFRAME_FOR_IE9_ID);
            NativeMethods.setAttribute.call(uploadIFrame, 'name', this.UPLOAD_IFRAME_FOR_IE9_ID);
            uploadIFrame.style.display = 'none';

            NativeMethods.querySelector.call(document, '#root' + SHADOW_UI_CLASSNAME_POSTFIX).appendChild(uploadIFrame);
        }

        return uploadIFrame;
    }

    _loadFileListDataForIE9 (input, callback) {
        var form = input.form;

        if (form && input.value) {
            var sourceTarget       = form.target;
            var sourceActionString = form.action;
            var sourceMethod       = form.method;
            var uploadIFrame       = this._getUploadIFrameForIE9();

            var loadHandler = () => {
                var fileListWrapper = new FileListWrapper([JSON.parse(uploadIFrame.contentWindow.document.body.innerHTML)]);

                uploadIFrame.removeEventListener('load', loadHandler);
                callback(fileListWrapper);
            };

            uploadIFrame.addEventListener('load', loadHandler);

            form.action = Settings.get().IE9_FILE_READER_SHIM_URL + '?input-name=' + input.name + '&filename=' +
                          input.value;
            form.target = this.UPLOAD_IFRAME_FOR_IE9_ID;
            form.method = 'post';

            form.submit();

            form.action = sourceActionString;
            form.target = sourceTarget;
            form.method = sourceMethod;
        }
        else
            callback(new FileListWrapper([]));
    }

    clearUploadInfo (input) {
        var inputInfo = this.getUploadInfo(input);

        if (inputInfo) {
            inputInfo.files = new FileListWrapper([]);
            inputInfo.value = '';

            return HiddenInfo.removeInputInfo(input);
        }
    }

    formatValue (fileNames) {
        var value = '';

        fileNames = typeof fileNames === 'string' ? [fileNames] : fileNames;

        if (fileNames && fileNames.length) {
            if (Browser.isWebKit)
                value = this.FAKE_PATH_STRING + fileNames[0].split('/').pop();
            else if (Browser.isIE9 || Browser.isIE10) {
                var filePaths = [];

                for (var i = 0; i < fileNames.length; i++)
                    filePaths.push(this.FAKE_PATH_STRING + fileNames[i].split('/').pop());

                value = filePaths.join(', ');
            }
            else
                return fileNames[0].split('/').pop();
        }

        return value;
    }

    getFileNames (fileList, value) {
        var result = [];

        if (fileList) {
            for (var i = 0; i < fileList.length; i++)
                result.push(fileList[i].name);
        }
        else if (value.lastIndexOf('\\') !== -1)
            result.push(value.substr(value.lastIndexOf('\\') + 1));

        return result;
    }

    getFiles (input) {
        var inputInfo = this.getUploadInfo(input);

        return inputInfo ? inputInfo.files : new FileListWrapper([]);
    }

    getUploadInfo (input) {
        for (var i = 0; i < this.uploadInfo.length; i++) {
            if (this.uploadInfo[i].input === input)
                return this.uploadInfo[i];
        }

        return null;
    }

    getValue (input) {
        var inputInfo = this.getUploadInfo(input);

        return inputInfo ? inputInfo.value : '';
    }

    loadFileListData (input, fileList, callback) {
        if (Browser.isIE9)
            this._loadFileListDataForIE9(input, callback);
        else if (!fileList.length)
            callback(new FileListWrapper([]));
        else {
            var index           = 0;
            var fileReader      = new FileReader();
            var file            = fileList[index];
            var readedFiles     = [];

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
                    callback(new FileListWrapper(readedFiles));
            });
            fileReader.readAsDataURL(file);
        }
    }

    loadFilesInfoFromServer (filePaths, callback) {
        Transport.asyncServiceMsg({
            cmd:       ServiceCommands.GET_UPLOADED_FILES,
            filePaths: typeof filePaths === 'string' ? [filePaths] : filePaths
        }, callback);
    }

    prepareFileListWrapper (filesInfo, callback) {
        var errs           = [];
        var validFilesInfo = [];

        for (var i = 0; i < filesInfo.length; i++) {
            if (filesInfo[i].err)
                errs.push(filesInfo[i]);
            else
                validFilesInfo.push(filesInfo[i]);
        }

        callback(errs, new FileListWrapper(validFilesInfo));
    }

    setUploadInfo (input, fileList, value) {
        var inputInfo = this.getUploadInfo(input);

        if (!inputInfo) {
            inputInfo = { input: input };
            this.uploadInfo.push(inputInfo);
        }

        inputInfo.files = fileList;
        inputInfo.value = value;

        HiddenInfo.addInputInfo(input, fileList, value);
    }

    sendFilesInfoToServer (fileList, fileNames, callback) {
        Transport.asyncServiceMsg({
            cmd:       ServiceCommands.UPLOAD_FILES,
            data:      this._getFileListData(fileList),
            fileNames: fileNames
        }, callback);
    }
}
