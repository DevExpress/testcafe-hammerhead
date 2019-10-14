import { ServiceMessage } from './proxy';

export interface FileInfo {
    name: string;
    type: string;
    data: string;
}

export interface FileInputInfo {
    name: string;
    files: Array<FileInfo>;
    value: string;
}

export interface GetUploadedFilesServiceMessage extends ServiceMessage {
    filePaths: Array<string>;
}

export interface StoreUploadedFilesServiceMessage extends ServiceMessage {
    data: Array<string>;
    fileNames: Array<string>;
}
