const Asar       = require('../../../lib/utils/asar');
const path       = require('path');
const { expect } = require('chai');

describe('Asar', () => {
    it('isAsar (GH-2033)', () => {
        const asar = new Asar();

        const filePath            = path.resolve(__dirname, './../data/file-in-asar-archive/directory-looks-like-archive.asar/app.asar/folder-in-asar-archive/another-folder/src.txt').replace(/\\/g, '/');
        const expectedArchivePath = filePath.replace('/folder-in-asar-archive/another-folder/src.txt', '');

        const nonExistPath        = path.resolve(__dirname, './../data/file-in-asar-archive/directory-looks-like-archive.asar/non-exist-app.asar/non-exist-file.txt').replace(/\\/g, '/');
        const nonExistArchivePath = nonExistPath.replace('/non-exist-file.txt', '');

        asar._archivePaths.add(nonExistArchivePath);

        expect(asar._archivePaths.size).eql(1);

        return asar.isAsar(nonExistPath)
            .then(result => {
                expect(result).eql(false);
                expect(asar._archivePaths.size).eql(0);

                return asar.isAsar(filePath);
            })
            .then(result => {
                expect(result).eql(true);
                expect(asar._archivePaths.size).eql(1);
                expect(asar._archivePaths.has(expectedArchivePath)).eql(true);
            });
    });
});
