import fs from 'fs';
import mime from 'mime';
import path from 'path';
import Promise from 'promise';

export default class UploadStorage {
    constructor (storagePath) {
        this.storageFolder = storagePath;

        this.readFile  = Promise.denodeify(fs.readFile);
        this.stat      = Promise.denodeify(fs.stat);
        this.writeFile = Promise.denodeify(fs.writeFile);
    }

    async _loadFile (filePath) {
        var fileContent = await this.readFile(filePath);
        var stats       = await this.stat(filePath);

        return {
            data: fileContent.toString('base64'),
            info: {
                lastModifiedDate: stats.mtime,
                name:             path.basename(filePath),
                type:             mime.lookup(filePath)
            }
        };
    }

    async _processFiles (fileNames, processor) {
        var processTasks = fileNames.map(fileName => {
            return (async () => {
                var resolvedPath = path.resolve(this.storageFolder, fileName);

                try {
                    return await processor(resolvedPath, fileName);
                }
                catch (e) {
                    return {
                        err:  e.toString(),
                        path: resolvedPath
                    };
                }
            })();
        });

        return await Promise.all(processTasks)
            .then(result => {
                result = result.filter(value => !!value);

                return result.length ? result : null;
            });
    }

    async store (fileNames, data) {
        return await this._processFiles(fileNames, async (resolvedPath, fileName) => {
            var content = new Buffer(data[fileNames.indexOf(fileName)], 'base64');

            await this.writeFile(resolvedPath, content);
        });
    }

    async get (paths) {
        return await this._processFiles(paths, async (resolvedPath) => {
            return await this._loadFile(resolvedPath);
        });
    }
}
