import fs from 'fs';
import mime from 'mime';
import path from 'path';
import { format } from 'util';
import promisify from '../utils/promisify';

const readFile  = promisify(fs.readFile);
const stat      = promisify(fs.stat);
const readDir   = promisify(fs.readdir);
const makeDir   = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const exists    = fsPath => stat(fsPath).then(() => true, () => false);

export default class UploadStorage {
    constructor (uploadsRoot) {
        this.uploadsRoot = uploadsRoot;
    }

    static async _getFilesToCopy (files) {
        const filesToCopy = [];
        const errs        = [];

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

    static _generateName (existingNames, fileName) {
        const extName  = path.extname(fileName);
        const template = path.basename(fileName, extName) + ' %s' + extName;
        let index      = 0;

        while (existingNames.includes(fileName))
            fileName = format(template, ++index);

        return fileName;
    }

    async _getExistingFiles () {
        try {
            return await readDir(this.uploadsRoot);
        }
        catch (e) {
            return [];
        }
    }

    async store (fileNames, data) {
        const storedFiles = [];
        const err         = await this.ensureUploadsRoot();

        if (err)
            return [{ err: err.toString(), path: this.uploadsRoot }];

        const existingFiles = await this._getExistingFiles(this.uploadsRoot);

        for (const fileName of fileNames) {
            const storedFileName = UploadStorage._generateName(existingFiles, fileName);
            const storedFilePath = path.join(this.uploadsRoot, storedFileName);

            try {
                await writeFile(storedFilePath, data[storedFiles.length], { encoding: 'base64' });

                existingFiles.push(storedFileName);
                storedFiles.push({ path: storedFilePath, file: fileName });
            }
            catch (e) {
                storedFiles.push({ err: e.toString(), path: storedFilePath, file: fileName });
            }
        }

        return storedFiles;
    }

    async get (filePathList) {
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

    async copy (files) {
        const { filesToCopy, errs } = await UploadStorage._getFilesToCopy(files);
        const copiedFiles           = [];

        if (!filesToCopy.length)
            return { copiedFiles, errs };

        const existingFiles = await this._getExistingFiles(this.uploadsRoot);

        for (const file of filesToCopy) {
            const copiedFileName = UploadStorage._generateName(existingFiles, file.name);
            const copiedFilePath = path.join(this.uploadsRoot, copiedFileName);

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

    async ensureUploadsRoot () {
        try {
            if (!await exists(this.uploadsRoot))
                await makeDir(this.uploadsRoot);

            return null;
        }
        catch (err) {
            return err;
        }
    }
}
