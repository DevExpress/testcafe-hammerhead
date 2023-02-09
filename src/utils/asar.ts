import asar from '@electron/asar';
import { toReadableStream } from './buffer';
import path from 'path';
import { stat } from './promisified-functions';
import { Readable } from 'stream';

interface ParsedPath {
    archive: string;
    fileName: string;
}

const ASAR_EXTNAME = '.asar';

export default class Asar {
    private _archivePaths: Set<string> = new Set<string>();

    private static async _isAsarArchive (archivePath: string): Promise<boolean> {
        try {
            const stats = await stat(archivePath);

            return stats.isFile() && path.extname(archivePath) === ASAR_EXTNAME;
        }
        catch (e) {
            return false;
        }
    }

    private async _findArchivePath (fullPath: string): Promise<string> {
        let currentPath = fullPath;
        let currentDir  = path.dirname(currentPath);

        while (currentPath !== currentDir) {
            if (await Asar._isAsarArchive(currentPath))
                return currentPath;

            currentPath = path.dirname(currentPath);
            currentDir  = path.dirname(currentPath);
        }

        return '';
    }

    parse (fullPath: string): ParsedPath {
        for (const archivePath of this._archivePaths) {
            if (fullPath.startsWith(archivePath))
                return { archive: archivePath, fileName: fullPath.substr(archivePath.length + 1) };
        }

        return { archive: '', fileName: '' };
    }

    async isAsar (fullPath: string): Promise<boolean> {
        for (const archivePath of this._archivePaths) {
            if (fullPath.startsWith(archivePath)) {
                if (!await Asar._isAsarArchive(archivePath)) {
                    this._archivePaths.delete(archivePath);

                    break;
                }

                return true;
            }
        }

        const archivePath = await this._findArchivePath(fullPath);

        if (archivePath) {
            this._archivePaths.add(archivePath);

            return true;
        }

        return false;
    }

    extractFileToReadStream (archive: string, fileName: string): Readable {
        const extractedFile = asar.extractFile(archive, fileName);

        return toReadableStream(extractedFile);
    }

    getFileInAsarNotFoundErrorMessage (archive: string, fileName: string): string {
        return `Cannot find the "${fileName.replace(/\\/g, '/')}" file in the "${archive.replace(/\\/g, '/')}" archive.`;
    }

    getArchivePath (fullPath: string): string {
        return this.parse(fullPath).archive;
    }
}
