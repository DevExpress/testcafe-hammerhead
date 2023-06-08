import MessageSandbox from '../sandbox/event/message';
import TransportBase from './transport-base';
import TransportInWorker from './transport-in-worker';
import { ServiceMessage } from '../../typings/proxy';
import Promise from 'pinkie';
import TransportInSocket from './transport-in-socket';


export default class Transport {
    private _implementation: TransportBase;

    start (messageSandbox: MessageSandbox, useWorker = true): void {
        this._implementation = useWorker
            ? new TransportInWorker()
            : new TransportInSocket();

        this._implementation.start(messageSandbox);
    }

    asyncServiceMsg (msg: ServiceMessage): Promise<any> {
        return this._implementation.asyncServiceMsg(msg);
    }

    queuedAsyncServiceMsg (msg: ServiceMessage): Promise<any> {
        return this._implementation.queuedAsyncServiceMsg(msg);
    }

    // NOTE: for testcafe-legacy-api
    batchUpdate (): Promise<any> {
        return this._implementation.batchUpdate();
    }

    // NOTE: for testcafe-legacy-api
    waitForServiceMessagesCompleted (timeout: number): Promise<void> {
        return this._implementation.waitForServiceMessagesCompleted(timeout);
    }
}
