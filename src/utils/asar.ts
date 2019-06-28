// @ts-ignore
import asar from 'asar';
import { toReadableStream } from './buffer';
import { Readable } from 'stream'; // eslint-disable-line no-unused-vars
import path from 'path';
import fs from 'fs';

const ASAR_EXTNAME = '.asar';

export function extractFileToReadStream (archive: string, fileName: string) : Readable {
    const extractedFile = asar.extractFile(archive, fileName);

    return toReadableStream(extractedFile);
}

export function getParentAsarArchivePath (fullPath: string) : string {
    let currentPath = fullPath;
    let currentDir  = path.dirname(currentPath);

    while (currentPath !== currentDir) {
        let isFile = false;

        try {
            isFile = fs.statSync(currentPath).isFile();
        }
        // eslint-disable-next-line no-empty
        catch (e) {
        }

        if (isFile && path.extname(currentPath) === ASAR_EXTNAME)
            return currentPath;

        currentPath = path.dirname(currentPath);
        currentDir  = path.dirname(currentPath);
    }

    return '';
}
