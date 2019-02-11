import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import SandboxBase from '../base';
import UploadInfoManager from './info-manager';
import { isFileInput } from '../../utils/dom';
import { isIE, version as browserVersion } from '../../utils/browser';
import { stopPropagation, preventDefault } from '../../utils/event';
import { get as getSandboxBackup } from '../backup';
import nativeMethods from '../native-methods';

export default class UploadSandbox extends SandboxBase {
    START_FILE_UPLOADING_EVENT: string = 'hammerhead|event|start-file-uploading';
    END_FILE_UPLOADING_EVENT: string = 'hammerhead|event|end-file-uploading';

    infoManager: UploadInfoManager;
    listeners: any;
    eventSimulator: any;

    constructor (listeners, eventSimulator, shadowUI) {
        super();

        this.infoManager = new UploadInfoManager(shadowUI);

        this.listeners = listeners;
        this.eventSimulator = eventSimulator;
    }

    _riseChangeEvent (input: HTMLInputElement) {
        this.eventSimulator.change(input);
    }

    static _getCurrentInfoManager (input: HTMLInputElement) {
        // @ts-ignore
        const contextWindow = input[INTERNAL_PROPS.processedContext];

        return getSandboxBackup(contextWindow).upload.infoManager;
    }

    /*eslint-disable max-nested-callbacks */
    attach (window: Window) {
        super.attach(window);

        this.listeners.addInternalEventListener(window, ['change'], (e, dispatched) => {
            const input              = e.target;
            const currentInfoManager = UploadSandbox._getCurrentInfoManager(input);

            if (isFileInput(input) && !dispatched) {
                stopPropagation(e);
                preventDefault(e);

                const value = nativeMethods.inputValueGetter.call(input);

                if (!!value || !!currentInfoManager.getValue(input)) {
                    const files     = nativeMethods.inputFilesGetter.call(input);
                    const fileNames = UploadInfoManager.getFileNames(files, value);

                    this.emit(this.START_FILE_UPLOADING_EVENT, fileNames, input);

                    currentInfoManager.loadFileListData(input, files)
                        .then(fileList => {
                            currentInfoManager.setUploadInfo(input, fileList, value);

                            return UploadInfoManager.sendFilesInfoToServer(fileList, fileNames);
                        })
                        .then(uploadInfo => {
                            this._riseChangeEvent(input);
                            this.emit(this.END_FILE_UPLOADING_EVENT, uploadInfo);
                        });
                }
            }
        });

        if (isIE) {
            // NOTE: Prevent the browser's open file dialog.
            this.listeners.addInternalEventListener(window, ['click'], (e, dispatched) => {
                const input = e.target || e.srcElement;

                if (isFileInput(input) && dispatched)
                    preventDefault(e, true);
            });
        }
    }

    /*eslint-enable max-nested-callbacks */

    static getFiles (input: HTMLInputElement) {
        const files = nativeMethods.inputFilesGetter.call(input);

        return files !== void 0 ? UploadSandbox._getCurrentInfoManager(input).getFiles(input) : void 0;
    }

    static getUploadElementValue (input: HTMLInputElement) {
        return UploadSandbox._getCurrentInfoManager(input).getValue(input);
    }

    setUploadElementValue (input: HTMLInputElement, value: string) {
        if (value === '') {
            if (UploadSandbox._getCurrentInfoManager(input).clearUploadInfo(input) && isIE && browserVersion > 10)
                this._riseChangeEvent(input);
        }

        return value;
    }

    doUpload (input: HTMLInputElement, filePaths) {
        const currentInfoManager = UploadSandbox._getCurrentInfoManager(input);

        filePaths = filePaths || [];

        return UploadInfoManager.loadFilesInfoFromServer(filePaths)
            .then(filesInfo => UploadInfoManager.prepareFileListWrapper(filesInfo))
            .then(data => {
                if (!data.errs.length) {
                    const value = UploadInfoManager.formatValue(filePaths);

                    currentInfoManager.setUploadInfo(input, data.fileList, value);
                    this._riseChangeEvent(input);
                }

                return data.errs;
            });
    }
}
