import request from './request';
import { ServiceMessage } from '../../typings/proxy';
import { HANDLE_PORT_CMD, SET_INITIAL_WORKER_SETTINGS_CMD } from '../transport/consts';

import {
    InitialWorkerSettings,
    ServiceMessageWrapper,
    WorkerMessage,
    MessageResponse,
} from '../../typings/transport';

type AsyncMessageCallback = (e: MessageResponse) => void;

interface QueuedMessage {
    msg: ServiceMessage;
    callback: AsyncMessageCallback;
}

interface MessageQueue { [key: string]: QueuedMessage[] }

let serviceMsgUrl            = '';
let sessionId                = '';
const msgQueue: MessageQueue = {};

function asyncServiceMsg (msg: ServiceMessage, callback: AsyncMessageCallback) {
    request(serviceMsgUrl, msg, (err, data) => callback({ err, data }));
}

function queuedAsyncServiceMsg (msg: ServiceMessage, callback: AsyncMessageCallback) {
    if (!msgQueue[msg.cmd])
        msgQueue[msg.cmd] = [];

    msgQueue[msg.cmd].push({ msg, callback });

    const asyncMsgCallback = (result: MessageResponse) => {
        const queuedMsg = msgQueue[msg.cmd].shift();

        queuedMsg.callback(result);

        if (msgQueue[msg.cmd].length)
            asyncServiceMsg(msgQueue[msg.cmd][0].msg, asyncMsgCallback);
    };

    if (msgQueue[msg.cmd].length === 1)
        asyncServiceMsg(msg, asyncMsgCallback);
}

const messageListener = e => {
    if (e.data.cmd === SET_INITIAL_WORKER_SETTINGS_CMD) {
        const settings = e.data as InitialWorkerSettings;

        serviceMsgUrl = settings.serviceMsgUrl;
        sessionId     = settings.sessionId;
    }

    else if (e.data.cmd === HANDLE_PORT_CMD)
        e.ports[0].onmessage = messageListener;

    else {
        const msgWrapper = e.data as ServiceMessageWrapper;
        const msg        = msgWrapper.msg;

        const callback: AsyncMessageCallback = result => e.target.postMessage({ id: msgWrapper.id, result } as WorkerMessage);

        msg.sessionId = sessionId;

        if (msgWrapper.queued)
            queuedAsyncServiceMsg(msg, callback);
        else
            asyncServiceMsg(msg, callback);
    }
};

self.addEventListener('message', messageListener);
