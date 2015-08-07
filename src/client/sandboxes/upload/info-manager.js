/*global atob, Blob, FileReader*/
import * as Browser from '../../utils/browser';
import * as HiddenInfo from './hidden-info';
import NativeMethods from '../native-methods';
import ServiceCommands from '../../../service-msg-cmd';
import Const from '../../../const';
import Transport from '../../transport';
import Settings from '../../settings';

const FAKE_PATH_STRING         = 'C:\\fakepath\\';
const UPLOAD_IFRAME_FOR_IE9_ID = 'uploadIFrameForIE9' + Const.SHADOW_UI_CLASSNAME_POSTFIX;

var uploadInfo = [];

function FileListWrapper (length) {
    this.length = length;
    this.item   = function (index) {
        return this[index];
    };
}

function base64ToBlob (base64Data, mimeType, sliceSize) {
    mimeType  = mimeType || '';
    sliceSize = sliceSize || 512;

    var byteCharacters = atob(base64Data);
    var byteArrays     = [];

    for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        var slice       = byteCharacters.slice(offset, offset + sliceSize);
        var byteNumbers = new Array(slice.length);

        for (var i = 0; i < slice.length; i++)
            byteNumbers[i] = slice.charCodeAt(i);

        byteArrays.push(new Uint8Array(byteNumbers));
    }

    return new Blob(byteArrays, { type: mimeType });
}

function createFileListWrapper (fileList) {
    var fileListWrapper = new FileListWrapper(fileList.length);

    for (var i = 0; i < fileList.length; i++)
        fileListWrapper[i] = createFileWrapper(fileList[i]);

    return fileListWrapper;
}

function createFileWrapper (fileInfo) {
    var wrapper = null;

    /*eslint-disable indent */
    if (!window.Blob) {
        wrapper = {
            size: fileInfo.info.size,
            type: fileInfo.info.type
        };
    }
    else if (fileInfo.blob)
        wrapper = new Blob([fileInfo.blob], { type: fileInfo.info.type });
    else
        wrapper = base64ToBlob(fileInfo.data, fileInfo.info.type);
    /*eslint-enable indent*/

    wrapper.name             = fileInfo.info.name;
    wrapper.lastModifiedDate = new Date(fileInfo.info.lastModifiedDate);
    wrapper.base64           = fileInfo.data;

    return wrapper;
}

function getFileListData (fileList) {
    var data = [];

    for (var i = 0; i < fileList.length; i++)
        data.push(fileList[i].base64);

    return data;
}

function getUploadIFrameForIE9 () {
    var uploadIFrame = NativeMethods.querySelector.call(document, '#' + UPLOAD_IFRAME_FOR_IE9_ID);

    if (!uploadIFrame) {
        uploadIFrame               = NativeMethods.createElement.call(document, 'iframe');

        NativeMethods.setAttribute.call(uploadIFrame, 'id', UPLOAD_IFRAME_FOR_IE9_ID);
        NativeMethods.setAttribute.call(uploadIFrame, 'name', UPLOAD_IFRAME_FOR_IE9_ID);
        uploadIFrame.style.display = 'none';

        NativeMethods.querySelector.call(document, '#root' +
                                                   Const.SHADOW_UI_CLASSNAME_POSTFIX).appendChild(uploadIFrame);
    }

    return uploadIFrame;
}

function loadFileListDataForIE9 (input, callback) {
    var form = input.form;

    /*eslint-disable indent */
    if (form && input.value) {
        var sourceTarget       = form.target;
        var sourceActionString = form.action;
        var sourceMethod       = form.method;
        var uploadIFrame       = getUploadIFrameForIE9();

        var loadHandler = function () {
            var fileListWrapper = new FileListWrapper(1);

            fileListWrapper[0] = createFileWrapper(JSON.parse(uploadIFrame.contentWindow.document.body.innerHTML));
            uploadIFrame.removeEventListener('load', loadHandler);
            callback(fileListWrapper);
        };

        uploadIFrame.addEventListener('load', loadHandler);

        form.action = Settings.get().IE9_FILE_READER_SHIM_URL + '?input-name=' + input.name + '&filename=' + input.value;
        form.target = UPLOAD_IFRAME_FOR_IE9_ID;
        form.method = 'post';

        form.submit();

        form.action = sourceActionString;
        form.target = sourceTarget;
        form.method = sourceMethod;
    }
    else
        callback(new FileListWrapper(0));
    /*eslint-enable indent */
}


export function clearUploadInfo (input) {
    var inputInfo = getUploadInfo(input);

    if (inputInfo) {
        inputInfo.files = createFileListWrapper([]);
        inputInfo.value = '';

        return HiddenInfo.removeInputInfo(input);
    }
}

export function formatValue (fileNames) {
    var value = '';

    fileNames = typeof fileNames === 'string' ? [fileNames] : fileNames;

    if (fileNames && fileNames.length) {
        /*eslint-disable indent */
        if (Browser.isWebKit)
            value = FAKE_PATH_STRING + fileNames[0].split('/').pop();
        else if (Browser.isIE9 || Browser.isIE10) {
            var filePaths = [];

            for (var i = 0; i < fileNames.length; i++)
                filePaths.push(FAKE_PATH_STRING + fileNames[i].split('/').pop());

            value = filePaths.join(', ');
        }
        else
            return fileNames[0].split('/').pop();
        /*eslint-enable indent */
    }

    return value;
}

export function getFileNames (fileList, value) {
    var result = [];

    /*eslint-disable indent */
    if (fileList) {
        for (var i = 0; i < fileList.length; i++)
            result.push(fileList[i].name);
    }
    else if (value.lastIndexOf('\\') !== -1)
        result.push(value.substr(value.lastIndexOf('\\') + 1));
    /*eslint-enable indent */

    return result;
}

export function getFiles (input) {
    var inputInfo = getUploadInfo(input);

    return inputInfo ? inputInfo.files : createFileListWrapper([]);
}

export function getUploadInfo (input) {
    for (var i = 0; i < uploadInfo.length; i++) {
        if (uploadInfo[i].input === input)
            return uploadInfo[i];
    }

    return null;
}

export function getValue (input) {
    var inputInfo = getUploadInfo(input);

    return inputInfo ? inputInfo.value : '';
}

export function loadFileListData (input, fileList, callback) {
    if (Browser.isIE9)
        loadFileListDataForIE9(input, callback);
    else if (!fileList.length)
        callback(new FileListWrapper(0));
    else {
        var index           = 0;
        var fileReader      = new FileReader();
        var file            = fileList[index];
        var fileListWrapper = new FileListWrapper(fileList.length);

        fileReader.addEventListener('load', function (e) {
            fileListWrapper[index] = createFileWrapper({
                data: e.target.result.substr(e.target.result.indexOf(',') + 1),
                blob: file.slice(0, file.size),
                info: {
                    type:             file.type,
                    name:             file.name,
                    lastModifiedDate: file.lastModifiedDate
                }
            });

            /*eslint-disable indent */
            if (fileList[++index]) {
                file = fileList[index];
                fileReader.readAsDataURL(file);
            }
            else
                callback(fileListWrapper);
            /*eslint-enable indent */
        });
        fileReader.readAsDataURL(file);
    }
}

export function loadFilesInfoFromServer (filePaths, callback) {
    Transport.asyncServiceMsg({
        cmd:       ServiceCommands.GET_UPLOADED_FILES,
        filePaths: typeof filePaths === 'string' ? [filePaths] : filePaths
    }, callback);
}

export function prepareFileListWrapper (filesInfo, callback) {
    var errs           = [];
    var validFilesInfo = [];

    for (var i = 0; i < filesInfo.length; i++)
        (filesInfo[i].err ? errs : validFilesInfo).push(filesInfo[i]);

    callback(errs, createFileListWrapper(validFilesInfo));
}

export function setUploadInfo (input, fileList, value) {
    var inputInfo = getUploadInfo(input);

    if (!inputInfo) {
        inputInfo = { input: input };
        uploadInfo.push(inputInfo);
    }

    inputInfo.files = fileList;
    inputInfo.value = value;

    HiddenInfo.addInputInfo(input, fileList, value);
}

export function sendFilesInfoToServer (fileList, fileNames, callback) {
    Transport.asyncServiceMsg({
        cmd:       ServiceCommands.UPLOAD_FILES,
        data:      getFileListData(fileList),
        fileNames: fileNames
    }, callback);
}
