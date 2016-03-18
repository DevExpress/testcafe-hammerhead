import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import SandboxBase from '../base';
import UploadInfoManager from './info-manager';
import { isFileInput } from '../../utils/dom';
import { isIE, version as browserVersion } from '../../utils/browser';
import { stopPropagation, preventDefault } from '../../utils/event';
import { get as getSandboxBackup } from '../backup';

export default class UploadSandbox extends SandboxBase {
    constructor (listeners, eventSimulator, shadowUI) {
        super();

        this.START_FILE_UPLOADING_EVENT = 'hammerhead|event|start-file-uploading';
        this.END_FILE_UPLOADING_EVENT   = 'hammerhead|event|end-file-uploading';

        this.infoManager = new UploadInfoManager(shadowUI);

        this.listeners = listeners;
        this.eventSimulator = eventSimulator;
    }

    _riseChangeEvent (input) {
        this.eventSimulator.change(input);
    }

    static _getCurrentInfoManager (input) {
        var contextWindow = input[INTERNAL_PROPS.processedContext];

        return getSandboxBackup(contextWindow).upload.infoManager;
    }

    /*eslint-disable max-nested-callbacks */
    attach (window) {
        super.attach(window);

        this.listeners.addInternalEventListener(window, ['change'], (e, dispatched) => {
            var input              = e.target;
            var currentInfoManager = UploadSandbox._getCurrentInfoManager(input);

            if (isFileInput(input) && !dispatched) {
                stopPropagation(e);
                preventDefault(e);

                if (!!input.value || !!currentInfoManager.getValue(input)) {
                    var fileNames = UploadInfoManager.getFileNames(input.files, input.value);

                    this.emit(this.START_FILE_UPLOADING_EVENT, fileNames, input);

                    currentInfoManager.loadFileListData(input, input.files)
                        .then(fileList => {
                            currentInfoManager.setUploadInfo(input, fileList, input.value);
                            return UploadInfoManager.sendFilesInfoToServer(fileList, fileNames);
                        })
                        .then(errs => {
                            this._riseChangeEvent(input);
                            this.emit(this.END_FILE_UPLOADING_EVENT, errs);
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

    doUpload (input, filePaths) {
        var currentInfoManager = UploadSandbox._getCurrentInfoManager(input);

        filePaths = filePaths || [];

        return UploadInfoManager.loadFilesInfoFromServer(filePaths)
            .then(filesInfo => UploadInfoManager.prepareFileListWrapper(filesInfo))
            .then(data => {
                if (!data.errs.length) {
                    var value = UploadInfoManager.formatValue(filePaths);

                    currentInfoManager.setUploadInfo(input, data.fileList, value);
                    this._riseChangeEvent(input);
                }

                return data.errs;
            });
    }
}
