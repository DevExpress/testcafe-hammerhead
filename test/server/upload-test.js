const fs            = require('fs');
const expect        = require('chai').expect;
const tmp           = require('tmp');
const mime          = require('mime');
const path          = require('path');
const upload        = require('../../lib/upload');
const FormData      = require('../../lib/upload/form-data');
const UploadStorage = require('../../lib/upload/storage');

const BOUNDARY     = 'separator';
const CONTENT_TYPE = 'multipart/form-data; boundary=' + BOUNDARY;

const dataFiles = [
    'empty',
    'empty-with-separator',
    'empty-with-separator-and-newline',
    'filename-name',
    'filename-no-name',
    'preamble-newline',
    'preamble-string',
    'epilogue-string',
    'special-chars-in-file-name',
    'missing-hyphens',
    'empty-headers',
];

const data = dataFiles.reduce((dataFile, filename) => {
    const content = fs.readFileSync('test/server/data/form-data/' + filename + '.formdata');

    // NOTE: Force \r\n new lines.
    dataFile[filename] = newLineReplacer(content);

    return dataFile;
}, {});

function newLineReplacer (content) {
    return Buffer.from(content.toString().replace(/\r\n|\n/gm, '\r\n'));
}

function initFormData (name) {
    const formData = new FormData();

    formData.parseContentTypeHeader(CONTENT_TYPE);
    formData.parseBody(data[name]);

    return formData;
}

describe('Upload', () => {
    describe('Form data parsing', () => {
        it('Should parse empty form data', () => {
            const cases = [
                'empty',
                'empty-with-separator',
                'empty-with-separator-and-newline',
            ];

            cases.forEach(item => {
                const formData = initFormData(item);

                expect(formData._entries).to.be.empty;
                expect(formData._preamble).to.be.empty;
            });
        });

        it('Should parse filename', () => {
            const formData = initFormData('filename-name');
            const entry    = formData._entries[0];
            const body     = Buffer.concat(entry.body).toString();

            expect(entry.name).eql('upload');
            expect(entry.fileName).eql('plain.txt');
            expect(entry._headers.get('content-type')).eql({ rawName: 'Content-Type', value: 'text/plain' });
            expect(body).eql('I am a plain text file\r\n');
        });

        it('Should parse filename with special characters', () => {
            const formData = initFormData('special-chars-in-file-name');
            const entry0   = formData._entries[0];
            const body0    = Buffer.concat(entry0.body).toString();
            const entry1   = formData._entries[1];
            const body1    = Buffer.concat(entry1.body).toString();


            expect(entry0.name).eql('title');
            expect(body0).eql('Weird filename');

            expect(entry1.name).eql('upload');
            expect(entry1.fileName).eql(': \\ ? % * | &#9731; %22 < > . ? ; \' @ # $ ^ & ( ) - _ = + { } [ ] ` ~.txt');
            expect(entry1._headers.get('content-type')).eql({ rawName: 'Content-Type', value: 'text/plain' });
            expect(body1).eql('I am a text file with a funky name!\r\n');
        });

        it('Should parse empty filename', () => {
            const formData = initFormData('filename-no-name');
            const entry    = formData._entries[0];
            const body     = Buffer.concat(entry.body).toString();

            expect(entry.name).eql('upload');
            expect(entry.fileName).to.be.empty;
            expect(entry._headers.get('content-type')).eql({ rawName: 'Content-Type', value: 'text/plain' });
            expect(body).eql('I am a plain text file\r\n');
        });

        it('Should parse preamble', () => {
            const formData = initFormData('preamble-string');
            const entry    = formData._entries[0];
            const body     = Buffer.concat(entry.body).toString();

            expect(formData._preamble).to.have.length(1);
            expect(formData._preamble[0].toString()).eql('This is a preamble which should be ignored');
            expect(entry.name).eql('upload');
            expect(entry.fileName).eql('plain.txt');
            expect(entry._headers.get('content-type')).eql({ rawName: 'Content-Type', value: 'text/plain' });
            expect(body).eql('I am a plain text file\r\n');
        });

        it('Should parse new line preamble', () => {
            const formData = initFormData('preamble-newline');
            const entry    = formData._entries[0];
            const body     = Buffer.concat(entry.body).toString();

            expect(formData._preamble).to.have.length(1);
            expect(formData._preamble[0].toString()).to.be.empty;
            expect(entry.name).eql('upload');
            expect(entry.fileName).eql('plain.txt');
            expect(entry._headers.get('content-type')).eql({ rawName: 'Content-Type', value: 'text/plain' });
            expect(body).eql('I am a plain text file\r\n');
        });

        it('Should parse epilogue', () => {
            const formData = initFormData('epilogue-string');
            const entry    = formData._entries[0];
            const body     = Buffer.concat(entry.body).toString();

            expect(formData._epilogue).to.have.length(1);
            expect(formData._epilogue[0].toString()).eql('This is a epilogue which should be ignored');
            expect(entry.name).eql('upload');
            expect(entry.fileName).eql('plain.txt');
            expect(entry._headers.get('content-type')).eql({ rawName: 'Content-Type', value: 'text/plain' });
            expect(body).eql('I am a plain text file\r\n');
        });

        it('Should parse if separator misses trailing hyphens', () => {
            const formData = initFormData('missing-hyphens');
            const entry    = formData._entries[0];
            const body     = Buffer.concat(entry.body).toString();

            expect(entry.name).eql('upload');
            expect(entry.fileName).eql('plain.txt');
            expect(entry._headers.get('content-type')).eql({ rawName: 'Content-Type', value: 'text/plain' });
            expect(body).eql('I am a plain text file\r\n');
        });

        it('Should parse empty headers', () => {
            const formData = initFormData('empty-headers');
            const entry    = formData._entries[0];
            const body     = Buffer.concat(entry.body).toString();

            expect(entry.name).to.be.not.ok;
            expect(entry.fileName).to.be.not.ok;
            expect(entry._headers.get('content-type')).eql({ rawName: 'Content-Type', value: '' });
            expect(entry._headers.get('content-disposition')).eql({ rawName: 'Content-Disposition', value: '' });
            expect(body).eql('text');
        });

    });

    describe('Form data formatting', () => {
        it('Should format malformed data', () => {
            const cases = [
                { src: 'empty', expected: '--' + BOUNDARY + '--\r\n' },
                { src: 'empty-with-separator', expected: '--' + BOUNDARY + '--\r\n' },
                { src: 'empty-with-separator-and-newline', expected: '--' + BOUNDARY + '--\r\n' },
                { src: 'missing-hyphens', expected: data['missing-hyphens'].toString() + '--\r\n' },
            ];

            cases.forEach(testCase => {
                const formData = initFormData(testCase.src);

                expect(formData.toBuffer().toString()).eql(testCase.expected);
            });
        });

        it('Should format data with missing headers', () => {
            const formData = initFormData('empty-headers');
            const actual   = formData.toBuffer().toString().replace(/ /g, '');
            const expected = data['empty-headers'].toString().replace(/ /g, '');

            expect(actual).eql(expected);
        });

        it('Should format form data', () => {
            const cases = [
                'filename-name',
                'filename-no-name',
                'preamble-newline',
                'preamble-string',
                'epilogue-string',
                'special-chars-in-file-name',
            ];

            cases.forEach(dataName => {
                const formData = initFormData(dataName);
                const actual   = formData.toBuffer().toString();
                const expected = data[dataName].toString();

                expect(actual).eql(expected);
            });
        });
    });

    describe('Upload storage', () => {
        const SRC_PATH = 'test/server/data/upload/';
        let tmpDirObj  = null;

        beforeEach(() => {
            tmpDirObj = tmp.dirSync();
        });

        afterEach(() => tmpDirObj.removeCallback());

        function getStoredFilePath (fileName) {
            return path.resolve(path.join(tmpDirObj.name, fileName));
        }

        function getSrcFilePath (fileName) {
            return path.resolve(path.join(SRC_PATH, fileName));
        }

        function assertFileContentsIdentical (path1, path2) {
            expect(fs.readFileSync(path1).toString()).eql(fs.readFileSync(path2).toString());
        }

        function assertFileExistence (filePath) {
            expect(fs.existsSync(filePath)).to.be.true;
        }

        function assertCorrectErr (errMsg, filePath) {
            if (Array.isArray(filePath)) {
                expect(errMsg.err).include('Cannot find the');
                expect(errMsg.resolvedPaths).eql(filePath);
            }
            else {
                expect(errMsg.err).include('ENOENT');
                expect(errMsg.resolvedPath || errMsg.path).eql(filePath);
            }
        }

        function assetCorrectFileInfo (fileInfo, fileName, filePath) {
            expect(fileInfo.data).eql(fs.readFileSync(filePath).toString('base64'));
            expect(fileInfo.info.name).eql(fileName);
            expect(fileInfo.info.type).eql(mime.lookup(filePath));
            expect(fileInfo.info.lastModifiedDate).eql(fs.statSync(filePath).mtime);
            expect(fileInfo.info.lastModified).eql(fs.statSync(filePath).mtimeMs);
        }

        it('Should store and get file', () => {
            const storage        = new UploadStorage(tmpDirObj.name);
            const srcFilePath    = getSrcFilePath('file-to-upload.txt');
            const storedFilePath = getStoredFilePath('file-to-upload.txt');

            return storage
                .store(['file-to-upload.txt'], [fs.readFileSync(srcFilePath).toString('base64')])
                .then(result => {
                    expect(result.length).eql(1);
                    expect(result[0]).to.not.have.property('err');
                    expect(result[0].file).eql('file-to-upload.txt');
                    expect(result[0].path).eql(storedFilePath);
                    assertFileExistence(storedFilePath);
                    assertFileContentsIdentical(storedFilePath, srcFilePath);

                    return storage.get(['file-to-upload.txt']);
                }).then(result => {
                    expect(result.length).eql(1);
                    assetCorrectFileInfo(result[0], 'file-to-upload.txt', storedFilePath);

                    fs.unlinkSync(storedFilePath);
                });
        });

        it('Should return an error if storing or getting is impossible', () => {
            const storage = new UploadStorage(tmpDirObj.name);

            return storage
                .store(['file-to-/upload.txt'], [Buffer.from('123').toString('base64')])
                .then(result => {
                    expect(result.length).eql(1);
                    assertCorrectErr(result[0], getStoredFilePath('file-to-/upload.txt'));

                    return storage.get(['file-to-upload.txt']);
                })
                .then(result => {
                    expect(result.length).eql(1);
                    assertCorrectErr(result[0], [getStoredFilePath('file-to-upload.txt')]);
                });
        });

        it('Should store and get multiple files', () => {
            const storage          = new UploadStorage(tmpDirObj.name);
            const file1Path        = getSrcFilePath('expected.formdata');
            const file2Path        = getSrcFilePath('src.formdata');
            const fakeFilePath     = getStoredFilePath('fake-file.txt');
            const file1StoragePath = getStoredFilePath('expected.formdata');
            const file2StoragePath = getStoredFilePath('src.formdata');

            return storage
                .store(
                    ['expected.formdata', 'src.formdata'],
                    [fs.readFileSync(file1Path).toString('base64'), fs.readFileSync(file2Path).toString('base64')],
                )
                .then(result => {
                    expect(result.length).eql(2);
                    assertFileExistence(file1StoragePath);
                    assertFileExistence(file2StoragePath);
                    assertFileContentsIdentical(file1StoragePath, file1Path);
                    assertFileContentsIdentical(file2StoragePath, file2Path);

                    return storage.get(['expected.formdata', 'src.formdata', 'fake-file.txt']);
                })
                .then(result => {
                    expect(result.length).eql(3);
                    assetCorrectFileInfo(result[0], 'expected.formdata', file1StoragePath);
                    assetCorrectFileInfo(result[1], 'src.formdata', file2StoragePath);
                    assertCorrectErr(result[2], [fakeFilePath]);

                    fs.unlinkSync(file1StoragePath);
                    fs.unlinkSync(file2StoragePath);
                });
        });

        it('Should not rewrite a file if it has a same name', () => {
            const storage        = new UploadStorage(tmpDirObj.name);
            const storedFilePath = getStoredFilePath('file.txt');

            return storage
                .store(['file.txt'], [Buffer.from('text').toString('base64')])
                .then(result => {
                    expect(result.length).eql(1);
                    expect(result[0]).to.not.have.property('err');
                    expect(result[0].file).eql('file.txt');
                    expect(result[0].path).eql(storedFilePath);

                    return storage.store(['file.txt'], [Buffer.from('text').toString('base64')]);
                })
                .then(result => {
                    const storedFilePath1 = storedFilePath.replace(/file\.txt/, 'file 1.txt');

                    expect(result.length).eql(1);
                    expect(result[0]).to.not.have.property('err');
                    expect(result[0].file).eql('file 1.txt');
                    expect(result[0].path).eql(storedFilePath1);

                    fs.unlinkSync(storedFilePath);
                    fs.unlinkSync(storedFilePath1);
                });
        });

        it('Should create upload folder if it does not exists', () => {
            const storage = new UploadStorage(tmpDirObj.name);

            return UploadStorage
                .ensureUploadsRoot(tmpDirObj.name)
                .then(result => {
                    expect(result).to.be.null;
                    expect(fs.statSync(tmpDirObj.name).isDirectory()).to.be.true;

                    fs.rmdirSync(tmpDirObj.name);

                    return UploadStorage.ensureUploadsRoot(tmpDirObj.name);
                })
                .then(result => {
                    expect(result).to.be.null;
                    expect(fs.statSync(tmpDirObj.name).isDirectory()).to.be.true;

                    fs.rmdirSync(tmpDirObj.name);

                    return storage.store(['temp.txt'], [Buffer.from('temp').toString('base64')]);
                })
                .then(result => {
                    const tempFilePath = getStoredFilePath('temp.txt');

                    expect(result.length).eql(1);
                    assertFileExistence(tempFilePath);
                    expect(fs.statSync(tmpDirObj.name).isDirectory()).to.be.true;

                    fs.unlinkSync(tempFilePath);
                });
        });

        it('Should copy files to upload directory', () => {
            const file1Path = getSrcFilePath('file-to-upload.txt');
            const file2Path = getSrcFilePath('expected.formdata');
            const file3Path = getSrcFilePath('file-does-not-exist');

            return UploadStorage
                .copy(tmpDirObj.name, [
                    { name: 'file-to-upload.txt', path: file1Path },
                    { name: 'expected.formdata', path: file2Path },
                    { name: 'file-does-not-exist', path: file3Path },
                    { name: path.basename(SRC_PATH), path: SRC_PATH },
                ])
                .then(({ copiedFiles, errs }) => {
                    const copiedFile1Path = getStoredFilePath('file-to-upload.txt');
                    const copiedFile2Path = getStoredFilePath('expected.formdata');

                    expect(copiedFiles).to.deep.equal([copiedFile1Path, copiedFile2Path]);
                    assertFileExistence(copiedFile1Path);
                    assertFileExistence(copiedFile2Path);
                    assertFileContentsIdentical(copiedFile1Path, file1Path);
                    assertFileContentsIdentical(copiedFile2Path, file2Path);

                    expect(errs.length).eql(1);
                    expect(errs[0].path).eql(file3Path);
                    expect(errs[0].err.code).eql('ENOENT');

                    return UploadStorage.copy(tmpDirObj.name, [{ name: 'file-to-upload.txt', path: file1Path }]);
                })
                .then(({ copiedFiles, errs }) => {
                    const copiedFilePath = getStoredFilePath('file-to-upload 1.txt');

                    expect(copiedFiles).to.deep.equal([copiedFilePath]);
                    assertFileExistence(copiedFilePath);
                    assertFileContentsIdentical(copiedFilePath, file1Path);
                    expect(errs.length).eql(0);

                    fs.unlinkSync(getStoredFilePath('file-to-upload.txt'));
                    fs.unlinkSync(getStoredFilePath('expected.formdata'));
                    fs.unlinkSync(copiedFilePath);
                });
        });

        it('Should remove duplicated upload roots', () => {
            const storage = new UploadStorage(['/folder/1', '/folder/2', '/folder/1']);

            expect(storage.uploadRoots.length).eql(2);
            expect(storage.uploadRoots[0]).eql('/folder/1');
            expect(storage.uploadRoots[1]).eql('/folder/2');
        });
    });

    it('Should inject uploads', () => {
        const testCases = [
            {
                srcPath:      'test/server/data/upload/src.formdata',
                expectedPath: 'test/server/data/upload/expected.formdata',
            },
            {
                srcPath:      'test/server/data/upload/multiple-inputs-and-one-file-src.formdata',
                expectedPath: 'test/server/data/upload/multiple-inputs-and-one-file-expected.formdata',
            },
        ];

        testCases.forEach(({ srcPath, expectedPath }) => {
            const src      = newLineReplacer(fs.readFileSync(srcPath));
            const expected = newLineReplacer(fs.readFileSync(expectedPath));
            const actual   = upload.inject(CONTENT_TYPE, src);

            expect(actual.toString()).eql(expected.toString());
        });
    });

    it('Should remove only the information about hidden input (GH-395)', () => {
        const src      = newLineReplacer(fs.readFileSync('test/server/data/upload/empty-file-info-src.formdata'));
        const expected = newLineReplacer(fs.readFileSync('test/server/data/upload/empty-file-info-expected.formdata'));
        const actual   = upload.inject(CONTENT_TYPE, src);

        expect(actual.toString()).eql(expected.toString());
    });
});
