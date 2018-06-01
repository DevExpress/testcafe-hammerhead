import fs from 'fs';
import mime from 'mime';
import path from 'path';
import promisify from '../utils/promisify';

const readFile  = promisify(fs.readFile);
const stat      = promisify(fs.stat);
const writeFile = promisify(fs.writeFile);

export default class UploadStorage {
    constructor (uploadsRoot) {
        this.uploadsRoot = uploadsRoot;
    }

    static async _loadFile (filePath) {
        const fileContent = await readFile(filePath);
        const stats       = await stat(filePath);

        return {
            data: fileContent.toString('base64'),
            info: {
                lastModifiedDate: stats.mtime,
                name:             path.basename(filePath),
                type:             mime.lookup(filePath)
            }
        };
    }

    async _runFileProcessingTask (fileName, processor) {
        const resolvedPath = path.resolve(this.uploadsRoot, fileName);

        try {
            return await processor(resolvedPath, fileName);
        }
        catch (e) {
            return {
                err:  e.toString(),
                path: resolvedPath
            };
        }
    }

    async _processFiles (fileNames, processor) {
        const processTasks = fileNames.map(fileName => this._runFileProcessingTask(fileName, processor));
        let result         = await Promise.all(processTasks);

        result = result.filter(value => !!value);

        return result.length ? result : null;
    }

    async store (fileNames, data) {
        return await this._processFiles(fileNames, async (resolvedPath, fileName) => {
            const content = Buffer.from(data[fileNames.indexOf(fileName)], 'base64');

            await writeFile(resolvedPath, content);
        });
    }

    async get (paths) {
        return await this._processFiles(paths, async resolvedPath => await UploadStorage._loadFile(resolvedPath));
    }
}
