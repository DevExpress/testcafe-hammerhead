// @ts-ignore
import asar from 'asar';
import { toReadableStream } from './buffer';
import { Readable } from 'stream'; // eslint-disable-line no-unused-vars

const ASAR_ARCHIVE_PATH = /(^.+?\.asar)(?:\/)/;

export function isAsarPath (fullPath: string) : boolean {
    return ASAR_ARCHIVE_PATH.test(fullPath);
}

export function getArchiveName (fullName: string) : string {
    const match = fullName.match(ASAR_ARCHIVE_PATH);

    return match ? match[1] : '';
}

export function extractFileToReadStream (fullPath: string) : Readable {
    const archive       = getArchiveName(fullPath);
    const fileName      = fullPath.replace(ASAR_ARCHIVE_PATH, './');
    const extractedFile = asar.extractFile(archive, fileName);

    return toReadableStream(extractedFile);
}
