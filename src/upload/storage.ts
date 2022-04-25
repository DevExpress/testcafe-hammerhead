import { chain } from 'lodash';
import mime from 'mime';
import path from 'path';
import { format } from 'util';

import {
    readFile,
    stat,
    readDir,
    makeDir,
    writeFile,
    fsObjectExists,
} from '../utils/promisified-functions';

interface CopiedFileInfo {
    path: string;
    name: string;
}

interface CopyingError {
    err: Error;
    path: string;
}

interface ResolvePathError {
    err: string;
    path: string;
    resolvedPaths: string[];
}

interface ResolvePathResult extends Partial<ResolvePathError> {
    data?: string;
    info?: {
        [key: string]: unknown
    };
    resolvedPath?: string;
}

interface StoredFiles {
    err?: string;
    path: string;
    file: string;
}

export default class UploadStorage {
    uploadRoots: string[];

    constructor (uploadRoots: string[]) {
        this.uploadRoots = chain(uploadRoots).castArray().uniq().value();
    }

    static async _getFilesToCopy (files: CopiedFileInfo[]): Promise<{ filesToCopy: CopiedFileInfo[]; errs: CopyingError[] }> {
        const filesToCopy: CopiedFileInfo[] = [];
        const errs: CopyingError[]          = [];

        for (const file of files) {
            try {
                const stats = await stat(file.path);

                if (stats.isFile())
                    filesToCopy.push(file);
            }
            catch (err) {
                errs.push({ path: file.path, err });
            }
        }

        return { filesToCopy, errs };
    }

    static _generateName (existingNames: string[], fileName: string): string {
        const extName  = path.extname(fileName);
        const template = path.basename(fileName, extName) + ' %s' + extName;
        let index      = 0;

        while (existingNames.includes(fileName))
            fileName = format(template, ++index);

        return fileName;
    }

    static async _getExistingFiles (uploadsRoot: string): Promise<string[]> {
        try {
            return await readDir(uploadsRoot);
        }
        catch (e) {
            return [];
        }
    }

    async store (fileNames: string[], data: string[]) {
        const storedFiles    = [] as StoredFiles[];
        const mainUploadRoot = this.uploadRoots[0];
        const err            = await UploadStorage.ensureUploadsRoot(mainUploadRoot);

        if (err)
            return [{ err: err.toString(), path: mainUploadRoot }];

        const existingFiles = await UploadStorage._getExistingFiles(mainUploadRoot);

        for (const fileName of fileNames) {
            const storedFileName = UploadStorage._generateName(existingFiles, fileName);
            const storedFilePath = path.join(mainUploadRoot, storedFileName);

            try {
                await writeFile(storedFilePath, data[storedFiles.length], { encoding: 'base64' });

                existingFiles.push(storedFileName);
                storedFiles.push({ path: storedFilePath, file: storedFileName });
            }
            catch (e) {
                storedFiles.push({ err: e.toString(), path: storedFilePath, file: fileName });
            }
        }

        return storedFiles;
    }

    async _resolvePath (filePath: string, result: Partial<ResolvePathError>[]): Promise<string | null> {
        let resolvedPath = null as string | null;

        if (path.isAbsolute(filePath))
            resolvedPath = filePath;
        else {
            const nonExistingPaths = [] as string[];

            for (const uploadRoot of this.uploadRoots) {
                resolvedPath = path.resolve(uploadRoot, filePath);
                if (await fsObjectExists(resolvedPath))
                    break;

                nonExistingPaths.push(resolvedPath);
                resolvedPath = null;
            }

            if (resolvedPath === null) {
                result.push({
                    err:           `Cannot find the ${filePath}. None path of these exists: ${nonExistingPaths.join(', ')}.`,
                    path:          filePath,
                    resolvedPaths: nonExistingPaths,
                });
            }
        }

        return resolvedPath;
    }

    async get (filePathList: string[]) {
        const result = [] as ResolvePathResult[];

        for (const filePath of filePathList) {
            const resolvedPath = await this._resolvePath(filePath, result) as string | null;

            if (resolvedPath === null)
                continue;

            try {
                const fileContent = await readFile(resolvedPath);
                const fileStats   = await stat(resolvedPath);

                result.push({
                    data: fileContent.toString('base64'),
                    info: {
                        lastModifiedDate: fileStats.mtime,
                        lastModified:     fileStats.mtimeMs,
                        name:             path.basename(resolvedPath),
                        type:             mime.lookup(resolvedPath),
                    },
                });
            }
            catch (e) {
                result.push({ err: e.toString(), path: filePath, resolvedPath });
            }
        }

        return result;
    }

    static async copy (uploadsRoot: string, files: CopiedFileInfo[]): Promise<{ copiedFiles: string[]; errs: CopyingError[] }> {
        const { filesToCopy, errs }      = await UploadStorage._getFilesToCopy(files);
        const copiedFiles: string[] = [];

        if (!filesToCopy.length)
            return { copiedFiles, errs };

        const existingFiles = await UploadStorage._getExistingFiles(uploadsRoot);

        for (const file of filesToCopy) {
            const copiedFileName = UploadStorage._generateName(existingFiles, file.name);
            const copiedFilePath = path.join(uploadsRoot, copiedFileName);

            try {
                await writeFile(copiedFilePath, await readFile(file.path, null));

                existingFiles.push(copiedFileName);
                copiedFiles.push(copiedFilePath);
            }
            catch (err) {
                errs.push({ path: file.path, err });
            }
        }

        return { copiedFiles, errs };
    }

    static async ensureUploadsRoot (uploadsRoot: string): Promise<Error | null> {
        try {
            if (!await fsObjectExists(uploadsRoot))
                await makeDir(uploadsRoot);

            return null;
        }
        catch (err) {
            return err;
        }
    }
}
