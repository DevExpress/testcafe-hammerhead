import TransportBase from './transport-base';
import { ServiceMessage } from '../../typings/proxy';
import Promise from 'pinkie';
import settings from '../settings';
import { parse, stringify } from '../../utils/json';
import nativeMethods from '../sandbox/native-methods';

export default class TransportInSocket extends TransportBase {
    private socket: WebSocket;

    constructor () {
        super();

        this.socket = new nativeMethods.WebSocket(settings.get().serviceMsgUrl.replace('http', 'ws'));
    }

    public start (): void {
        // NOTE: There is no special logic here.
    }

    public queuedAsyncServiceMsg (msg: ServiceMessage): Promise<any> {
        return this.asyncServiceMsg(msg);
    }

    public asyncServiceMsg (msg: ServiceMessage): Promise<any> {
        return new Promise((resolve, reject) => {
            const handleMessage = (event) => {
                cleanListeners();
                this._activeServiceMsgCount--;

                resolve(parse(event.data));
            };

            const handleError = (error) => {
                cleanListeners();
                this._activeServiceMsgCount--;

                reject(new Error(error.toString()));
            };

            const handleClose = (event) => {
                cleanListeners();
                if (event.wasClean)
                    return;

                const errorMsg = `WebSocket request failed with ${event.code} status code.\nError message: ${event.reason}`;

                reject(new Error(errorMsg));
            };

            const cleanListeners = () => {
                this.socket.removeEventListener('message', handleMessage);
                this.socket.removeEventListener('error', handleError);
                this.socket.removeEventListener('close', handleClose);
            };

            msg.sessionId = settings.get().sessionId;

            if (this._shouldAddReferer)
                msg.referer = settings.get().referer;

            this._activeServiceMsgCount++;

            this.socket.addEventListener('message', handleMessage);
            this.socket.addEventListener('error', handleError);
            this.socket.addEventListener('close', handleClose);

            this.socket.send(stringify(msg));
        });
    }
}
