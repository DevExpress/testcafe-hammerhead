import { ServiceMessage } from '../../typings/proxy';
import Promise from 'pinkie';
import nativeMethods from '../sandbox/native-methods';
import settings from '../settings';
import { parseJSON, stringifyJSON } from '../../utils/json';

const SERVICE_MESSAGES_WAITING_INTERVAL = 50;

export default abstract class TransportLegacy {
    protected _activeServiceMsgCount = 0;

    private static _getStoredMessages (): ServiceMessage[] {
        const nativeLocalStorage = nativeMethods.winLocalStorageGetter.call(window);
        const storedMessagesStr  = nativeMethods.storageGetItem.call(nativeLocalStorage, settings.get().sessionId);

        return storedMessagesStr ? parseJSON(storedMessagesStr) : [];
    }

    protected static _storeMessage (msg: ServiceMessage): void {
        const storedMessages     = TransportLegacy._getStoredMessages();
        const nativeLocalStorage = nativeMethods.winLocalStorageGetter.call(window);

        storedMessages.push(msg);

        nativeMethods.storageSetItem.call(nativeLocalStorage, settings.get().sessionId, stringifyJSON(storedMessages));
    }

    protected static _removeMessageFromStore (cmd: string): void {
        const messages           = TransportLegacy._getStoredMessages();
        const nativeLocalStorage = nativeMethods.winLocalStorageGetter.call(window);

        for (let i = 0; i < messages.length; i++) {
            if (messages[i].cmd === cmd) {
                messages.splice(i, 1);

                break;
            }
        }

        nativeMethods.storageSetItem.call(nativeLocalStorage, settings.get().sessionId, stringifyJSON(messages));
    }

    batchUpdate (): Promise<any> {
        const storedMessages = TransportLegacy._getStoredMessages();

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

    abstract queuedAsyncServiceMsg (msg: ServiceMessage);

    abstract asyncServiceMsg (msg: ServiceMessage);
}
