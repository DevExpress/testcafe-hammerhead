// NOTE: There is no @types/asar
// @ts-ignore: Could not find a declaration file for module 'asar'
import asar from 'asar';
import { toReadableStream } from './buffer';
import path from 'path';
import { stat } from './promisified-functions';
/*eslint-disable no-unused-vars*/
import { Readable } from 'stream';
/*eslint-enable no-unused-vars*/

interface ParsedPath {
    archive: string;
    fileName: string;
}

const ASAR_EXTNAME: string = '.asar';

export default class Asar {
    private _archivePaths: Array<string> = [];

    private _addPath (asarPath: string) {
        if (this._archivePaths.indexOf(asarPath) === -1)
            this._archivePaths.push(asarPath);
    }

    private static async _isFile (fullPath: string) : Promise<boolean> {
        try {
            const stats = await stat(fullPath);

            return stats.isFile();
        }
        catch (e) {
            return false;
        }
    }

    private async _findArchivePath (fullPath: string) : Promise<string> {
        let currentPath = fullPath;
        let currentDir  = path.dirname(currentPath);

        while (currentPath !== currentDir) {
            if (await Asar._isFile(currentPath) && path.extname(currentPath) === ASAR_EXTNAME)
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

    async isAsar (fullPath: string) : Promise<boolean> {
        for (const archivePath of this._archivePaths) {
            if (fullPath.startsWith(archivePath))
                return true;
        }

        const archivePath = await this._findArchivePath(fullPath);

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
