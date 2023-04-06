import { ServiceMessage } from '../../typings/proxy';
import Promise from 'pinkie';
import nativeMethods from '../sandbox/native-methods';
import settings from '../settings';
import { parse as parseJSON, stringify as stringifyJSON } from '../../utils/json';
import { getFrameElement, isIframeWithoutSrc } from '../utils/dom';
import MessageSandbox from '../sandbox/event/message';

const SERVICE_MESSAGES_WAITING_INTERVAL = 50;

export default abstract class TransportBase {
    protected readonly _shouldAddReferer = TransportBase._shouldAddReferer();
    protected _activeServiceMsgCount = 0;

    private static _shouldAddReferer (): boolean {
        const frameElement = getFrameElement(window);

        return frameElement && isIframeWithoutSrc(frameElement);
    }

    private static _getStoredMessages (): ServiceMessage[] {
        const nativeLocalStorage = nativeMethods.winLocalStorageGetter.call(window);
        const storedMessagesStr  = nativeMethods.storageGetItem.call(nativeLocalStorage, settings.get().sessionId);

        return storedMessagesStr ? parseJSON(storedMessagesStr) : [];
    }

    protected static _storeMessage (msg: ServiceMessage): void {
        const storedMessages     = TransportBase._getStoredMessages();
        const nativeLocalStorage = nativeMethods.winLocalStorageGetter.call(window);

        storedMessages.push(msg);

        nativeMethods.storageSetItem.call(nativeLocalStorage, settings.get().sessionId, stringifyJSON(storedMessages));
    }

    protected static _removeMessageFromStore (cmd: string): void {
        const messages           = TransportBase._getStoredMessages();
        const initialMsgLength   = messages.length;
        const nativeLocalStorage = nativeMethods.winLocalStorageGetter.call(window);

        for (let i = 0; i < messages.length; i++) {
            if (messages[i].cmd === cmd) {
                messages.splice(i, 1);

                break;
            }
        }

        // NOTE: this condition is needed for nativeAutomation mode to preserve saving any data to localStorage
        // TODO: research why this works in proxy mode and does not work in nativeAutomation
        if (messages.length < initialMsgLength)
            nativeMethods.storageSetItem.call(nativeLocalStorage, settings.get().sessionId, stringifyJSON(messages));
    }

    batchUpdate (): Promise<any> {
        const storedMessages = TransportBase._getStoredMessages();

        if (!storedMessages.length)
            return Promise.resolve();

        const tasks              = [];
        const nativeLocalStorage = nativeMethods.winLocalStorageGetter.call(window);

        nativeMethods.storageRemoveItem.call(nativeLocalStorage, settings.get().sessionId);

        for (const storedMessage of storedMessages)
            tasks.push(this.queuedAsyncServiceMsg(storedMessage));

        return Promise.all(tasks);
    }

    waitForServiceMessagesCompleted (timeout: number): Promise<void> {
        return new Promise(resolve => {
            if (!this._activeServiceMsgCount) {
                resolve();

                return;
            }

            let intervalId  = null;
            const timeoutId = nativeMethods.setTimeout.call(window, () => {
                nativeMethods.clearInterval.call(window, intervalId);
                resolve();
            }, timeout);

            intervalId = nativeMethods.setInterval.call(window, () => {
                if (this._activeServiceMsgCount)
                    return;

                nativeMethods.clearInterval.call(window, intervalId);
                nativeMethods.clearTimeout.call(window, timeoutId);
                resolve();
            }, SERVICE_MESSAGES_WAITING_INTERVAL);
        });
    }

    abstract queuedAsyncServiceMsg (msg: ServiceMessage): Promise<any>;

    abstract asyncServiceMsg (msg: ServiceMessage): Promise<any>;

    abstract start (messageSandbox: MessageSandbox): void;
}
