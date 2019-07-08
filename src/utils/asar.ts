// @ts-ignore
import asar from 'asar';
import { toReadableStream } from './buffer';
import path from 'path';
import fs from 'fs';
/*eslint-disable no-unused-vars*/
import { Readable } from 'stream';
/*eslint-enable no-unused-vars*/

interface ParsedPath {
    archive: string;
    fileName: string;
}

const ASAR_EXTNAME: string = '.asar';

export default class Asar {
    private static _instance: Asar = new Asar();

    private _archivePaths: Array<string> = [];

    constructor () {
        if (Asar._instance)
            throw new Error('Error: Instantiation failed: Use Asar.getInstance() instead of new.');

        Asar._instance = this;
    }

    static getInstance () : Asar {
        return Asar._instance;
    }

    private _addPath (asarPath: string) {
        if (this._archivePaths.indexOf(asarPath) === -1)
            this._archivePaths.push(asarPath);
    }

    private _findArchivePath (fullPath: string) : string {
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

    private _parse (fullPath: string) : ParsedPath {
        let archive  = '';
        let fileName = '';

        for (const archivePath of this._archivePaths) {
            if (fullPath.startsWith(archivePath)) {
                archive  = archivePath;
                fileName = fullPath.replace(archivePath, '.');

                break;
            }
        }

        return { archive, fileName };
    }

    isAsar (fullPath: string) : boolean {
        for (const archivePath of this._archivePaths) {
            if (fullPath.startsWith(archivePath))
                return true;
        }

        const archivePath = this._findArchivePath(fullPath);

        if (archivePath) {
            this._addPath(archivePath);

            return true;
        }

        return false;
    }

    extractFileToReadStream (fullPath: string) : Readable {
        const parsedPath    = this._parse(fullPath);
        const extractedFile = asar.extractFile(parsedPath.archive, parsedPath.fileName);

        return toReadableStream(extractedFile);
    }

    getFileInAsarNotFoundMessage (fullPath: string) : string {
        const parsedAsarPath = this._parse(fullPath);

        return 'The target file ("' + parsedAsarPath.fileName + '") in asar archive ("' + parsedAsarPath.archive + '") is not found';
    }

    getArchivePath (fullPath: string) : string {
        return this._parse(fullPath).archive;
    }
}
