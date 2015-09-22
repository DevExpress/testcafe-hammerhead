import fs from 'fs';
import mime from 'mime';
import path from 'path';
import promisify from '../utils/promisify';
import { Promise } from 'es6-promise';

var readFile  = promisify(fs.readFile);
var stat      = promisify(fs.stat);
var writeFile = promisify(fs.writeFile);

export default class UploadStorage {
    constructor (storagePath) {
        this.storagePath = storagePath;
    }

    static async _loadFile (filePath) {
        var fileContent = await readFile(filePath);
        var stats       = await stat(filePath);

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
        var resolvedPath = path.resolve(this.storagePath, fileName);

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
        var processTasks = fileNames.map(fileName => this._runFileProcessingTask(fileName, processor));
        var result       = await Promise.all(processTasks);

        result = result.filter(value => !!value);

        return result.length ? result : null;
    }

    async store (fileNames, data) {
        return await this._processFiles(fileNames, async (resolvedPath, fileName) => {
            var content = new Buffer(data[fileNames.indexOf(fileName)], 'base64');

            await writeFile(resolvedPath, content);
        });
    }

    async get (paths) {
        return await this._processFiles(paths, async (resolvedPath) => {
            return await UploadStorage._loadFile(resolvedPath);
        });
    }
}
