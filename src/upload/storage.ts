// @ts-ignore
import mime from 'mime';
import path from 'path';
import { format } from 'util';
import { readFile, stat, readDir, makeDir, writeFile, fsObjectExists } from '../utils/promisified-functions';

interface CopiedFileInfo {
    path: string,
    name: string
}

interface CopyingError {
    err: Error,
    path: string
}

export default class UploadStorage {
    uploadsRoot: string;

    constructor (uploadsRoot: string) {
        this.uploadsRoot = uploadsRoot;
    }

    static async _getFilesToCopy (files: Array<CopiedFileInfo>): Promise<{ filesToCopy: Array<CopiedFileInfo>, errs: Array<CopyingError> }> {
        const filesToCopy: Array<CopiedFileInfo> = [];
        const errs: Array<CopyingError>          = [];

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

    static _generateName (existingNames: Array<string>, fileName: string) {
        const extName  = path.extname(fileName);
        const template = path.basename(fileName, extName) + ' %s' + extName;
        let index      = 0;

        while (existingNames.includes(fileName))
            fileName = format(template, ++index);

        return fileName;
    }

    static async _getExistingFiles (uploadsRoot: string): Promise<Array<string>> {
        try {
            return await readDir(uploadsRoot);
        }
        catch (e) {
            return [];
        }
    }

    async store (fileNames: Array<string>, data: Array<string>) {
        const storedFiles = [];
        const err         = await UploadStorage.ensureUploadsRoot(this.uploadsRoot);

        if (err)
            return [{ err: err.toString(), path: this.uploadsRoot }];

        const existingFiles = await UploadStorage._getExistingFiles(this.uploadsRoot);

        for (const fileName of fileNames) {
            const storedFileName = UploadStorage._generateName(existingFiles, fileName);
            const storedFilePath = path.join(this.uploadsRoot, storedFileName);

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

    async get (filePathList: Array<string>) {
        const result = [];

        for (const filePath of filePathList) {
            const resolvedPath = path.resolve(this.uploadsRoot, filePath);

            try {
                const fileContent = await readFile(resolvedPath);
                const fileStats   = await stat(resolvedPath);

                result.push({
                    data: fileContent.toString('base64'),
                    info: {
                        lastModifiedDate: fileStats.mtime,
                        name:             path.basename(resolvedPath),
                        type:             mime.lookup(resolvedPath)
                    }
                });
            }
            catch (e) {
                result.push({ err: e.toString(), path: filePath, resolvedPath });
            }
        }

        return result;
    }

    static async copy (uploadsRoot: string, files: Array<CopiedFileInfo>): Promise<{ copiedFiles: Array<string>, errs: Array<CopyingError> }> {
        const { filesToCopy, errs }      = await UploadStorage._getFilesToCopy(files);
        const copiedFiles: Array<string> = [];

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

    static async ensureUploadsRoot (uploadsRoot: string) {
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
