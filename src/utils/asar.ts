// @ts-ignore
import asar from 'asar';
import { toReadableStream } from './buffer';
import { Readable } from 'stream'; // eslint-disable-line no-unused-vars

const ASAR_ARCHIVE_PATH = /^.*\.asar/;

export function isAsarPath (fullPath: string) : boolean {
    return ASAR_ARCHIVE_PATH.test(fullPath);
}

export function getArchivePath (fullPath: string) : string {
    const match = fullPath.match(ASAR_ARCHIVE_PATH);

    return match ? match[0] : '';
}

export function extractFileToReadStream (fullPath: string) : Readable {
    const archive       = getArchivePath(fullPath);
    const fileName      = fullPath.replace(ASAR_ARCHIVE_PATH, '.');
    const extractedFile = asar.extractFile(archive, fileName);

    return toReadableStream(extractedFile);
}
