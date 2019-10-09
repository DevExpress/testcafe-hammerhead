// eslint-disable-next-line no-unused-vars
import { ServiceMessage } from './proxy';

export type InitialWorkerSettings = {
    cmd: string;
    sessionId: string;
    serviceMsgUrl: string;
};

export type ServiceMessageWrapper = {
    id: number;
    queued: boolean;
    msg: ServiceMessage;
};

export type MessageResponse = {
    data: any,
    err: string;
};

export type WorkerMessage = {
    id: number;
    result: MessageResponse
};
