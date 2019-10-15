import { ServiceMessage } from './proxy';

export interface FileInfo {
    name: string;
    type: string;
    data: string;
}

export interface FileInputInfo {
    name: string;
    files: FileInfo[];
    value: string;
}

export interface GetUploadedFilesServiceMessage extends ServiceMessage {
    filePaths: string[];
}

export interface StoreUploadedFilesServiceMessage extends ServiceMessage {
    data: string[];
    fileNames: string[];
}
