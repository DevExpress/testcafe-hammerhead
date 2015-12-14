var fs            = require('fs');
var express       = require('express');
var request       = require('request');
var expect        = require('chai').expect;
var tmp           = require('tmp');
var mime          = require('mime');
var path          = require('path');
var upload        = require('../../lib/upload');
var FormData      = require('../../lib/upload/form-data');
var UploadStorage = require('../../lib/upload/storage');

var BOUNDARY     = 'separator';
var CONTENT_TYPE = 'multipart/form-data; boundary=' + BOUNDARY;

var dataFiles = [
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

var data = dataFiles.reduce(function (data, filename) {
    var content = fs.readFileSync('test/server/data/form-data/' + filename + '.formdata');

    // NOTE: Force \r\n new lines.
    data[filename] = newLineReplacer(content);

    return data;
}, {});

function newLineReplacer (content) {
    return new Buffer(content.toString().replace(/\r\n|\n/gm, '\r\n'));
}

function initFormData (name) {
    var formData = new FormData();

    formData.parseContentTypeHeader(CONTENT_TYPE);
    formData.parseBody(data[name]);

    return formData;
}

describe('Upload', function () {
    describe('Form data parsing', function () {
        it('Should parse empty form data', function () {
            var cases = [
                'empty',
                'empty-with-separator',
                'empty-with-separator-and-newline'
            ];

            cases.forEach(function (data) {
                var formData = initFormData(data);

                expect(formData.entries).to.be.empty;
                expect(formData.preamble).to.be.empty;
            });
        });

        it('Should parse filename', function () {
            var formData = initFormData('filename-name');
            var entry    = formData.entries[0];
            var body     = Buffer.concat(entry.body).toString();

            expect(entry.name).eql('upload');
            expect(entry.fileName).eql('plain.txt');
            expect(entry.headers['Content-Type']).eql('text/plain');
            expect(body).eql('I am a plain text file\r\n');
        });

        it('Should parse filename with special characters', function () {
            var formData = initFormData('special-chars-in-file-name');
            var entry0   = formData.entries[0];
            var body0    = Buffer.concat(entry0.body).toString();
            var entry1   = formData.entries[1];
            var body1    = Buffer.concat(entry1.body).toString();


            expect(entry0.name).eql('title');
            expect(body0).eql('Weird filename');

            expect(entry1.name).eql('upload');
            expect(entry1.fileName).eql(': \\ ? % * | &#9731; %22 < > . ? ; \' @ # $ ^ & ( ) - _ = + { } [ ] ` ~.txt');
            expect(entry1.headers['Content-Type']).eql('text/plain');
            expect(body1).eql('I am a text file with a funky name!\r\n');
        });

        it('Should parse empty filename', function () {
            var formData = initFormData('filename-no-name');
            var entry    = formData.entries[0];
            var body     = Buffer.concat(entry.body).toString();

            expect(entry.name).eql('upload');
            expect(entry.fileName).to.be.empty;
            expect(entry.headers['Content-Type']).eql('text/plain');
            expect(body).eql('I am a plain text file\r\n');
        });

        it('Should parse preamble', function () {
            var formData = initFormData('preamble-string');
            var entry    = formData.entries[0];
            var body     = Buffer.concat(entry.body).toString();

            expect(formData.preamble).to.have.length(1);
            expect(formData.preamble[0].toString()).eql('This is a preamble which should be ignored');
            expect(entry.name).eql('upload');
            expect(entry.fileName).eql('plain.txt');
            expect(entry.headers['Content-Type']).eql('text/plain');
            expect(body).eql('I am a plain text file\r\n');
        });

        it('Should parse new line preamble', function () {
            var formData = initFormData('preamble-newline');
            var entry    = formData.entries[0];
            var body     = Buffer.concat(entry.body).toString();

            expect(formData.preamble).to.have.length(1);
            expect(formData.preamble[0].toString()).to.be.empty;
            expect(entry.name).eql('upload');
            expect(entry.fileName).eql('plain.txt');
            expect(entry.headers['Content-Type']).eql('text/plain');
            expect(body).eql('I am a plain text file\r\n');
        });

        it('Should parse epilogue', function () {
            var formData = initFormData('epilogue-string');
            var entry    = formData.entries[0];
            var body     = Buffer.concat(entry.body).toString();

            expect(formData.epilogue).to.have.length(1);
            expect(formData.epilogue[0].toString()).eql('This is a epilogue which should be ignored');
            expect(entry.name).eql('upload');
            expect(entry.fileName).eql('plain.txt');
            expect(entry.headers['Content-Type']).eql('text/plain');
            expect(body).eql('I am a plain text file\r\n');
        });

        it('Should parse if separator misses trailing hyphens', function () {
            var formData = initFormData('missing-hyphens');
            var entry    = formData.entries[0];
            var body     = Buffer.concat(entry.body).toString();

            expect(entry.name).eql('upload');
            expect(entry.fileName).eql('plain.txt');
            expect(entry.headers['Content-Type']).eql('text/plain');
            expect(body).eql('I am a plain text file\r\n');
        });

        it('Should parse empty headers', function () {
            var formData = initFormData('empty-headers');
            var entry    = formData.entries[0];
            var body     = Buffer.concat(entry.body).toString();

            expect(entry.name).to.be.not.ok;
            expect(entry.fileName).to.be.not.ok;
            expect(entry.headers['Content-Type']).to.be.empty;
            expect(entry.headers['Content-Disposition']).to.be.empty;
            expect(body).eql('text');
        });

    });

    describe('Form data formatting', function () {
        it('Should format malformed data', function () {
            var cases = [
                { src: 'empty', expected: '--' + BOUNDARY + '--\r\n' },
                { src: 'empty-with-separator', expected: '--' + BOUNDARY + '--\r\n' },
                { src: 'empty-with-separator-and-newline', expected: '--' + BOUNDARY + '--\r\n' },
                { src: 'missing-hyphens', expected: data['missing-hyphens'].toString() + '--\r\n' }
            ];

            cases.forEach(function (testCase) {
                var formData = initFormData(testCase.src);

                expect(formData.toBuffer().toString()).eql(testCase.expected);
            });
        });

        it('Should format data with missing headers', function () {
            var formData = initFormData('empty-headers');
            var actual   = formData.toBuffer().toString().replace(/ /g, '');
            var expected = data['empty-headers'].toString().replace(/ /g, '');

            expect(actual).eql(expected);
        });

        it('Should format form data', function () {
            var cases = [
                'filename-name',
                'filename-no-name',
                'preamble-newline',
                'preamble-string',
                'epilogue-string',
                'special-chars-in-file-name'
            ];

            cases.forEach(function (dataName) {
                var formData = initFormData(dataName);
                var actual   = formData.toBuffer().toString();
                var expected = data[dataName].toString();

                expect(actual).eql(expected);
            });
        });
    });

    describe('IE9 FileReader shim', function () {
        var server = null;

        before(function () {
            var app = express();

            app.post('/ie9-file-reader-shim', upload.ie9FileReaderShim);

            server = app.listen(2000);
        });

        after(function () {
            server.close();
        });

        it('Should provide file information', function (done) {
            var options = {
                method:  'POST',
                url:     'http://localhost:2000/ie9-file-reader-shim?filename=plain.txt&input-name=upload',
                body:    data['epilogue-string'],
                headers: {
                    'Content-Type': CONTENT_TYPE
                }
            };

            request(options, function (err, res, body) {
                var file         = JSON.parse(body);
                var expectedBody = 'I am a plain text file\r\n';

                expect(res.headers['content-type']).to.be.undefined;
                expect(new Buffer(file.data, 'base64').toString()).eql(expectedBody);
                expect(file.info.type).eql('text/plain');
                expect(file.info.name).eql('plain.txt');
                expect(file.info.size).eql(expectedBody.length);

                done();
            });
        });
    });

    describe('Upload storage', function () {
        var SRC_PATH  = 'test/server/data/upload/';
        var tmpDirObj = null;

        beforeEach(function () {
            tmpDirObj = tmp.dirSync();
        });

        afterEach(function () {
            tmpDirObj.removeCallback();
        });

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

        it('Should store and get file', function () {
            var storage = new UploadStorage(tmpDirObj.name);

            var srcFilePath    = getSrcFilePath('file-to-upload.txt');
            var storedFilePath = getStoredFilePath('file-to-upload.txt');

            return storage
                .store(['file-to-upload.txt'], [fs.readFileSync(srcFilePath)])
                .then(function (result) {
                    expect(result).to.be.null;
                    assertFileExistence(storedFilePath);
                    assertFileContentsIdentical(storedFilePath, srcFilePath);

                    return storage.get(['file-to-upload.txt']);
                }).then(function (result) {
                    expect(result.length).eql(1);
                    assetCorrectFileInfo(result[0], 'file-to-upload.txt', storedFilePath);

                    fs.unlinkSync(storedFilePath);
                });
        });

        it('Should return an error if storing or getting is impossible', function () {
            var storage        = new UploadStorage('this/path/will/not/exist/ever/');
            var storedFilePath = path.resolve(path.join('this/path/will/not/exist/ever/', 'file-to-upload.txt'));
            var filePath       = getSrcFilePath('file-to-upload.txt');

            return storage
                .store(['file-to-upload.txt'], [filePath])
                .then(function (result) {
                    expect(result.length).eql(1);
                    assertCorrectErr(result[0], storedFilePath);

                    return storage.get(['file-to-upload.txt']);
                })
                .then(function (result) {
                    expect(result.length).eql(1);
                    assertCorrectErr(result[0], storedFilePath);
                });
        });

        it('Should store and get multiple files', function () {
            var storage = new UploadStorage(tmpDirObj.name);

            var file1Path        = getSrcFilePath('expected.formdata');
            var file2Path        = getSrcFilePath('src.formdata');
            var fakeFilePath     = getStoredFilePath('fake-file.txt');
            var file1StoragePath = getStoredFilePath('expected.formdata');
            var file2StoragePath = getStoredFilePath('src.formdata');

            return storage
                .store(['expected.formdata', 'src.formdata'], [fs.readFileSync(file1Path), fs.readFileSync(file2Path)])
                .then(function (result) {
                    expect(result).to.be.null;
                    assertFileExistence(file1StoragePath);
                    assertFileExistence(file2StoragePath);
                    assertFileContentsIdentical(file1StoragePath, file1Path);
                    assertFileContentsIdentical(file2StoragePath, file2Path);

                    return storage.get(['expected.formdata', 'src.formdata', 'fake-file.txt']);
                })
                .then(function (result) {
                    expect(result.length).eql(3);
                    assetCorrectFileInfo(result[0], 'expected.formdata', file1StoragePath);
                    assetCorrectFileInfo(result[1], 'src.formdata', file2StoragePath);
                    assertCorrectErr(result[2], fakeFilePath);

                    fs.unlinkSync(file1StoragePath);
                    fs.unlinkSync(file2StoragePath);
                });
        });
    });

    it('Should inject uploads', function () {
        var src      = newLineReplacer(fs.readFileSync('test/server/data/upload/src.formdata'));
        var expected = newLineReplacer(fs.readFileSync('test/server/data/upload/expected.formdata'));
        var actual   = upload.inject(CONTENT_TYPE, src);

        expect(actual.toString()).eql(expected.toString());
    });
});
