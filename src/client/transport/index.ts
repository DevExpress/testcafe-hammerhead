import nativeMethods from '../sandbox/native-methods';
import settings from '../settings';
import { isWebKit, isFirefox } from '../utils/browser';
import Promise from 'pinkie';
import { isIframeWithoutSrc, getFrameElement } from '../utils/dom';
import IntegerIdGenerator from '../utils/integer-id-generator';
import { ServiceMessage } from '../../typings/proxy';
import MessageSandbox from '../sandbox/event/message';
import TransportLegacy from './transport-legacy';
import { HANDLE_PORT_CMD, SET_INITIAL_WORKER_SETTINGS_CMD } from './consts';
import { InitialWorkerSettings, ServiceMessageWrapper, WorkerMessage } from '../../typings/transport';

const GET_MESSAGE_PORT = 'hammerhead|command|get-message-port';
const SET_MESSAGE_PORT = 'hammerhead|command|set-message-port';

export default class Transport extends TransportLegacy {
    private _transportWorker: Worker | MessagePort | null = null;
    private readonly _idGenerator = new IntegerIdGenerator();
    private readonly _messageCallbacks: Map<number, (err: string, data: any) => void> = new Map();
    private readonly _queue: ServiceMessageWrapper[] = [];
    private readonly _shouldAddReferer = Transport._shouldAddReferer();

    start (messageSandbox: MessageSandbox) {
        if (window === window.top) {
            // @ts-ignore
            this._transportWorker = new nativeMethods.Worker(settings.get().transportWorkerUrl, { name: 'Transport' });

            this._transportWorker.postMessage({
                cmd:           SET_INITIAL_WORKER_SETTINGS_CMD,
                sessionId:     settings.get().sessionId,
                serviceMsgUrl: settings.get().serviceMsgUrl
            } as InitialWorkerSettings);

            this._transportWorker.addEventListener('message', (e: Event) => this._onWorkerMessage(e as MessageEvent));
            this._processQueue();
        }

        else
            messageSandbox.sendServiceMsg({ cmd: GET_MESSAGE_PORT }, window.top);

        messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, ({ message, source, ports }) => {
            if (message.cmd === GET_MESSAGE_PORT) {
                const channel = new nativeMethods.MessageChannel();

                messageSandbox.sendServiceMsg({ cmd: SET_MESSAGE_PORT }, source, [channel.port1]);
                this._transportWorker.postMessage({ cmd: HANDLE_PORT_CMD }, [channel.port2]);
            }

            else if (message.cmd === SET_MESSAGE_PORT) {
                this._transportWorker = ports[0] as MessagePort;
                this._transportWorker.onmessage = e => this._onWorkerMessage(e);
                this._processQueue();
            }
        });
    }

    private _processQueue () {
        for (const msgWrapper of this._queue)
            this._transportWorker.postMessage(msgWrapper);

        this._queue.length = 0;
    }

    private static _shouldAddReferer (): boolean {
        const frameElement = getFrameElement(window);

        return frameElement && isIframeWithoutSrc(frameElement);
    }

    private _onWorkerMessage (e: MessageEvent) {
        const { id, result } = e.data as WorkerMessage;

        if (!this._messageCallbacks.has(id))
            return;

        this._messageCallbacks.get(id)(result.err, result.data);
        this._messageCallbacks.delete(id);
    }

    asyncServiceMsg (msg: ServiceMessage, queued = false): Promise<any> {
        return new Promise((resolve, reject) => {
            const id = this._idGenerator.increment();

            ++this._activeServiceMsgCount;

            if (this._shouldAddReferer)
                msg.referer = settings.get().referer;

            this._messageCallbacks.set(id, (err, data) => {
                --this._activeServiceMsgCount;

                if (!err)
                    resolve(data);
                else {
                    if (!msg.disableResending && (isWebKit || isFirefox)) {
                        TransportLegacy._removeMessageFromStore(msg.cmd);
                        TransportLegacy._storeMessage(msg);
                        resolve();
                    }

                    if (msg.allowRejecting)
                        reject(new Error(err));
                }
            });

            if (this._transportWorker)
                this._transportWorker.postMessage({ id, queued, msg } as ServiceMessageWrapper);
            else
                this._queue.push({ id, queued, msg });
        });
    }

    queuedAsyncServiceMsg (msg: ServiceMessage): Promise<any> {
        return this.asyncServiceMsg(msg, true);
    }
}
