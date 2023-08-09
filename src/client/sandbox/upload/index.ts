import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import SandboxBase from '../base';
import UploadInfoManager from './info-manager';
import { isFileInput } from '../../utils/dom';

import {
    isFirefox,
    isChrome,
    isMacPlatform,
    isSafari,
} from '../../utils/browser';

import { stopPropagation, preventDefault } from '../../utils/event';
import { get as getSandboxBackup } from '../backup';
import nativeMethods from '../native-methods';
import Listeners from '../event/listeners';
import EventSimulator from '../event/simulator';
import Transport from '../../transport';
import settings from '../../settings';

export default class UploadSandbox extends SandboxBase {
    START_FILE_UPLOADING_EVENT = 'hammerhead|event|start-file-uploading';
    END_FILE_UPLOADING_EVENT = 'hammerhead|event|end-file-uploading';

    infoManager: UploadInfoManager;

    constructor (private readonly _listeners: Listeners,
        private readonly _eventSimulator: EventSimulator,
        transport: Transport) {
        super();

        this.infoManager = new UploadInfoManager(transport);
    }

    _riseChangeEvent (input: HTMLInputElement) {
        this._eventSimulator.change(input);
    }

    static _getCurrentInfoManager (input: HTMLInputElement) {
        const contextWindow = input[INTERNAL_PROPS.processedContext];

        return contextWindow && getSandboxBackup(contextWindow).upload.infoManager;
    }

    /*eslint-disable max-nested-callbacks */
    attach (window: Window & typeof globalThis) {
        super.attach(window);

        this._listeners.addInternalEventBeforeListener(window, ['change'], (e: Event, dispatched: boolean) => {
            const input              = nativeMethods.eventTargetGetter.call(e);
            const currentInfoManager = UploadSandbox._getCurrentInfoManager(input);

            if (!dispatched && isFileInput(input)) {
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

                            return this.infoManager.sendFilesInfoToServer(fileList, fileNames);
                        })
                        .then(uploadInfo => {
                            this._riseChangeEvent(input);
                            this.emit(this.END_FILE_UPLOADING_EVENT, uploadInfo);
                        });
                }
            }
        });

        if (!settings.get().isRecordMode && isFirefox) {
            // NOTE: Google Chrome and Safari don't open the native browser dialog when TestCafe clicks on the input.
            // 'Click' is a complex emulated action that uses 'dispatchEvent' method internally.
            // Another browsers open the native browser dialog in this case.
            // This is why, we are forced to prevent the browser's open file dialog.
            this._listeners.addInternalEventBeforeListener(window, ['click'], (e: Event, dispatched: boolean) => {
                if (dispatched && isFileInput(nativeMethods.eventTargetGetter.call(e)))
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
        const infoManager = UploadSandbox._getCurrentInfoManager(input);

        return infoManager ? infoManager.getValue(input) : '';
    }

    setUploadElementValue (input: HTMLInputElement, value: string): void {
        if (value === '')
            UploadSandbox._getCurrentInfoManager(input).clearUploadInfo(input);
    }

    // GH-1844, GH-2007
    static _shouldRaiseChangeEvent (filesToUpload, currentUploadInfo): boolean {
        if (!currentUploadInfo)
            return true;

        // eslint-disable-next-line no-restricted-properties
        const currentFiles = currentUploadInfo.files;

        if (filesToUpload.length !== currentFiles.length ||
            isFirefox || (isMacPlatform && isChrome || isSafari))
            return true;

        for (const file of filesToUpload) {
            let found = false;

            for (const currentFile of currentFiles) {
                if (file.name === currentFile.name) {
                    found = true;
                    break;
                }
            }

            if (found === false)
                return true;
        }

        return false;
    }

    doUpload (input: HTMLInputElement, filePaths: string | string[]) {
        const currentInfoManager = UploadSandbox._getCurrentInfoManager(input);

        filePaths = filePaths || [];

        return this.infoManager.loadFilesInfoFromServer(filePaths)
            .then(filesInfo => UploadInfoManager.prepareFileListWrapper(filesInfo))
            .then(data => {
                if (!data.errs.length) {
                    const value                 = UploadInfoManager.formatValue(filePaths);
                    const inputInfo             = currentInfoManager.getUploadInfo(input);
                    const shouldRaiseChangeEvent = UploadSandbox._shouldRaiseChangeEvent(data.fileList, inputInfo);

                    currentInfoManager.setUploadInfo(input, data.fileList, value);

                    if (shouldRaiseChangeEvent)
                        this._riseChangeEvent(input);
                }

                return data.errs;
            });
    }
}
