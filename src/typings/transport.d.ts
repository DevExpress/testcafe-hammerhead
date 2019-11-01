import { ServiceMessage } from './proxy';

export interface InitialWorkerSettings {
    cmd: string;
    sessionId: string;
    serviceMsgUrl: string;
}

export interface ServiceMessageWrapper {
    id: number;
    queued: boolean;
    msg: ServiceMessage;
}

export interface MessageResponse {
    data: any;
    err: string;
}

export interface WorkerMessage {
    id: number;
    result: MessageResponse;
}
