'use strict';

const fs            = require('fs');
const express       = require('express');
const request       = require('request');
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
    'empty-headers'
];

const data = dataFiles.reduce((dataFile, filename) => {
    const content = fs.readFileSync('test/server/data/form-data/' + filename + '.formdata');

    // NOTE: Force \r\n new lines.
    dataFile[filename] = newLineReplacer(content);

    return dataFile;
}, {});

function newLineReplacer (content) {
    return new Buffer(content.toString().replace(/\r\n|\n/gm, '\r\n'));
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
                'empty-with-separator-and-newline'
            ];

            cases.forEach(item => {
                const formData = initFormData(item);

                expect(formData.entries).to.be.empty;
                expect(formData.preamble).to.be.empty;
            });
        });

        it('Should parse filename', () => {
            const formData = initFormData('filename-name');
            const entry    = formData.entries[0];
            const body     = Buffer.concat(entry.body).toString();

            expect(entry.name).eql('upload');
            expect(entry.fileName).eql('plain.txt');
            expect(entry.headers['Content-Type']).eql('text/plain');
            expect(body).eql('I am a plain text file\r\n');
        });

        it('Should parse filename with special characters', () => {
            const formData = initFormData('special-chars-in-file-name');
            const entry0   = formData.entries[0];
            const body0    = Buffer.concat(entry0.body).toString();
            const entry1   = formData.entries[1];
            const body1    = Buffer.concat(entry1.body).toString();


            expect(entry0.name).eql('title');
            expect(body0).eql('Weird filename');

            expect(entry1.name).eql('upload');
            expect(entry1.fileName).eql(': \\ ? % * | &#9731; %22 < > . ? ; \' @ # $ ^ & ( ) - _ = + { } [ ] ` ~.txt');
            expect(entry1.headers['Content-Type']).eql('text/plain');
            expect(body1).eql('I am a text file with a funky name!\r\n');
        });

        it('Should parse empty filename', () => {
            const formData = initFormData('filename-no-name');
            const entry    = formData.entries[0];
            const body     = Buffer.concat(entry.body).toString();

            expect(entry.name).eql('upload');
            expect(entry.fileName).to.be.empty;
            expect(entry.headers['Content-Type']).eql('text/plain');
            expect(body).eql('I am a plain text file\r\n');
        });

        it('Should parse preamble', () => {
            const formData = initFormData('preamble-string');
            const entry    = formData.entries[0];
            const body     = Buffer.concat(entry.body).toString();

            expect(formData.preamble).to.have.length(1);
            expect(formData.preamble[0].toString()).eql('This is a preamble which should be ignored');
            expect(entry.name).eql('upload');
            expect(entry.fileName).eql('plain.txt');
            expect(entry.headers['Content-Type']).eql('text/plain');
            expect(body).eql('I am a plain text file\r\n');
        });

        it('Should parse new line preamble', () => {
            const formData = initFormData('preamble-newline');
            const entry    = formData.entries[0];
            const body     = Buffer.concat(entry.body).toString();

            expect(formData.preamble).to.have.length(1);
            expect(formData.preamble[0].toString()).to.be.empty;
            expect(entry.name).eql('upload');
            expect(entry.fileName).eql('plain.txt');
            expect(entry.headers['Content-Type']).eql('text/plain');
            expect(body).eql('I am a plain text file\r\n');
        });

        it('Should parse epilogue', () => {
            const formData = initFormData('epilogue-string');
            const entry    = formData.entries[0];
            const body     = Buffer.concat(entry.body).toString();

            expect(formData.epilogue).to.have.length(1);
            expect(formData.epilogue[0].toString()).eql('This is a epilogue which should be ignored');
            expect(entry.name).eql('upload');
            expect(entry.fileName).eql('plain.txt');
            expect(entry.headers['Content-Type']).eql('text/plain');
            expect(body).eql('I am a plain text file\r\n');
        });

        it('Should parse if separator misses trailing hyphens', () => {
            const formData = initFormData('missing-hyphens');
            const entry    = formData.entries[0];
            const body     = Buffer.concat(entry.body).toString();

            expect(entry.name).eql('upload');
            expect(entry.fileName).eql('plain.txt');
            expect(entry.headers['Content-Type']).eql('text/plain');
            expect(body).eql('I am a plain text file\r\n');
        });

        it('Should parse empty headers', () => {
            const formData = initFormData('empty-headers');
            const entry    = formData.entries[0];
            const body     = Buffer.concat(entry.body).toString();

            expect(entry.name).to.be.not.ok;
            expect(entry.fileName).to.be.not.ok;
            expect(entry.headers['Content-Type']).to.be.empty;
            expect(entry.headers['Content-Disposition']).to.be.empty;
            expect(body).eql('text');
        });

    });

    describe('Form data formatting', () => {
        it('Should format malformed data', () => {
            const cases = [
                { src: 'empty', expected: '--' + BOUNDARY + '--\r\n' },
                { src: 'empty-with-separator', expected: '--' + BOUNDARY + '--\r\n' },
                { src: 'empty-with-separator-and-newline', expected: '--' + BOUNDARY + '--\r\n' },
                { src: 'missing-hyphens', expected: data['missing-hyphens'].toString() + '--\r\n' }
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
                'special-chars-in-file-name'
            ];

            cases.forEach(dataName => {
                const formData = initFormData(dataName);
                const actual   = formData.toBuffer().toString();
                const expected = data[dataName].toString();

                expect(actual).eql(expected);
            });
        });
    });

    describe('IE9 FileReader shim', () => {
        let server = null;

        before(() => {
            const app = express();

            app.post('/ie9-file-reader-shim', upload.ie9FileReaderShim);

            server = app.listen(2000);
        });

        after(() => server.close());

        it('Should provide file information', done => {
            const options = {
                method:  'POST',
                url:     'http://localhost:2000/ie9-file-reader-shim?filename=plain.txt&input-name=upload',
                body:    data['epilogue-string'],
                headers: {
                    'Content-Type': CONTENT_TYPE
                }
            };

            request(options, (err, res, body) => {
                const file         = JSON.parse(body);
                const expectedBody = 'I am a plain text file\r\n';

                expect(res.headers['content-type']).to.be.undefined;
                expect(new Buffer(file.data, 'base64').toString()).eql(expectedBody);
                expect(file.info.type).eql('text/plain');
                expect(file.info.name).eql('plain.txt');
                expect(file.info.size).eql(expectedBody.length);

                done();
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
            expect(errMsg.err.indexOf('ENOENT')).not.eql(-1);
            expect(errMsg.path).eql(filePath);
        }

        function assetCorrectFileInfo (fileInfo, fileName, filePath) {
            expect(fileInfo.data).eql(fs.readFileSync(filePath).toString('base64'));
            expect(fileInfo.info.name).eql(fileName);
            expect(fileInfo.info.type).eql(mime.lookup(filePath));
            expect(fileInfo.info.lastModifiedDate).eql(fs.statSync(filePath).mtime);
        }

        it('Should store and get file', () => {
            const storage = new UploadStorage(tmpDirObj.name);

            const srcFilePath    = getSrcFilePath('file-to-upload.txt');
            const storedFilePath = getStoredFilePath('file-to-upload.txt');

            return storage
                .store(['file-to-upload.txt'], [fs.readFileSync(srcFilePath)])
                .then(result => {
                    expect(result).to.be.null;
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
            const storage        = new UploadStorage('this/path/will/not/exist/ever/');
            const storedFilePath = path.resolve(path.join('this/path/will/not/exist/ever/', 'file-to-upload.txt'));
            const filePath       = getSrcFilePath('file-to-upload.txt');

            return storage
                .store(['file-to-upload.txt'], [filePath])
                .then(result => {
                    expect(result.length).eql(1);
                    assertCorrectErr(result[0], storedFilePath);

                    return storage.get(['file-to-upload.txt']);
                })
                .then(result => {
                    expect(result.length).eql(1);
                    assertCorrectErr(result[0], storedFilePath);
                });
        });

        it('Should store and get multiple files', () => {
            const storage = new UploadStorage(tmpDirObj.name);

            const file1Path        = getSrcFilePath('expected.formdata');
            const file2Path        = getSrcFilePath('src.formdata');
            const fakeFilePath     = getStoredFilePath('fake-file.txt');
            const file1StoragePath = getStoredFilePath('expected.formdata');
            const file2StoragePath = getStoredFilePath('src.formdata');

            return storage
                .store(['expected.formdata', 'src.formdata'], [fs.readFileSync(file1Path), fs.readFileSync(file2Path)])
                .then(result => {
                    expect(result).to.be.null;
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
                    assertCorrectErr(result[2], fakeFilePath);

                    fs.unlinkSync(file1StoragePath);
                    fs.unlinkSync(file2StoragePath);
                });
        });
    });

    it('Should inject uploads', () => {
        const src      = newLineReplacer(fs.readFileSync('test/server/data/upload/src.formdata'));
        const expected = newLineReplacer(fs.readFileSync('test/server/data/upload/expected.formdata'));
        const actual   = upload.inject(CONTENT_TYPE, src);

        expect(actual.toString()).eql(expected.toString());
    });

    it('Should remove only the information about hidden input (GH-395)', () => {
        const src      = newLineReplacer(fs.readFileSync('test/server/data/upload/empty-file-info-src.formdata'));
        const expected = newLineReplacer(fs.readFileSync('test/server/data/upload/empty-file-info-expected.formdata'));
        const actual   = upload.inject(CONTENT_TYPE, src);

        expect(actual.toString()).eql(expected.toString());
    });
});
