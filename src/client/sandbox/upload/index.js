import SandboxBase from '../base';
import UploadInfoManager from './info-manager';
import { isFileInput } from '../../utils/dom';
import { isIE, version as browserVersion } from '../../utils/browser';
import { stopPropagation, preventDefault } from '../../utils/event';
import { DOM_SANDBOX_PROCESSED_CONTEXT } from '../../../const';
import { getSandboxFromStorage } from '../storage';

export default class UploadSandbox extends SandboxBase {
    constructor (sandbox) {
        super(sandbox);

        this.START_FILE_UPLOADING_EVENT = 'hammerhead|event|start-file-uploading';
        this.END_FILE_UPLOADING_EVENT   = 'hammerhead|event|end-file-uploading';

        this.infoManager = new UploadInfoManager();
    }

    _riseChangeEvent (input) {
        this.sandbox.event.eventSimulator.change(input);
    }

    static _getCurrentInfoManager (input) {
        var contextWindow = input[DOM_SANDBOX_PROCESSED_CONTEXT];

        return getSandboxFromStorage(contextWindow).upload.infoManager;
    }

    /*eslint-disable max-nested-callbacks */
    attach (window) {
        super.attach(window);

        this.sandbox.event.listeners.addInternalEventListener(window, ['change'], (e, dispatched) => {
            var input              = e.target || e.srcElement;
            var currentInfoManager = UploadSandbox._getCurrentInfoManager(input);

            if (isFileInput(input) && !dispatched) {
                stopPropagation(e);
                preventDefault(e);

                if (!!input.value || !!currentInfoManager.getValue(input)) {
                    var fileNames = UploadInfoManager.getFileNames(input.files, input.value);

                    this._emit(this.START_FILE_UPLOADING_EVENT, fileNames, input);

                    currentInfoManager.loadFileListData(input, input.files, fileList => {
                        currentInfoManager.setUploadInfo(input, fileList, input.value);
                        UploadInfoManager.sendFilesInfoToServer(fileList, fileNames, errs => {
                            this._riseChangeEvent(input);
                            this._emit(this.END_FILE_UPLOADING_EVENT, errs);
                        });
                    });
                }
            }
        });
    }

    /*eslint-enable max-nested-callbacks */

    static getFiles (input) {
        return input.files !== void 0 ? UploadSandbox._getCurrentInfoManager(input).getFiles(input) : void 0;
    }

    static getUploadElementValue (input) {
        return UploadSandbox._getCurrentInfoManager(input).getValue(input);
    }

    setUploadElementValue (input, value) {
        if (value === '') {
            if (UploadSandbox._getCurrentInfoManager(input).clearUploadInfo(input) && isIE && browserVersion > 10)
                this._riseChangeEvent(input);
        }

        return value;
    }

    upload (input, filePaths, callback) {
        var currentInfoManager = UploadSandbox._getCurrentInfoManager(input);

        filePaths = filePaths || [];

        UploadInfoManager.loadFilesInfoFromServer(filePaths, filesInfo => {
            UploadInfoManager.prepareFileListWrapper(filesInfo, (errs, fileList) => {
                if (!errs.length) {
                    var value = UploadInfoManager.formatValue(filePaths);

                    currentInfoManager.setUploadInfo(input, fileList, value);
                    this._riseChangeEvent(input);
                }

                callback(errs);
            });
        });
    }
}
