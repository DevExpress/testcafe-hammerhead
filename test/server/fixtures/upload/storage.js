var fs      = require('fs');
var expect  = require('chai').expect;
var path    = require('path');
var mime    = require('mime');
var cmd     = require('../../../../lib/service-msg-cmd');
var Session = require('../../../../lib/session');

var STORAGE_PATH      = 'test/server/data/upload/storage/';
var SRC_PATH          = 'test/server/data/upload/';
var FAKE_STORAGE_PATH = 'test/server/data/upload/none-existen/';

var session            = new Session(STORAGE_PATH);
var fakeStorageSession = new Session(FAKE_STORAGE_PATH);

var clientEmulator = {
    storing: function (session, fileNames, paths) {
        return session[cmd.UPLOAD_FILES]({
            fileNames: fileNames,
            data:      paths.map(function (path) {
                return fs.readFileSync(path);
            })
        });
    },

    getting: function (session, filePaths) {
        return session[cmd.GET_UPLOADED_FILES]({
            filePaths: filePaths
        });
    }
};

function getStorageFilePath (fileName) {
    return path.resolve(STORAGE_PATH + fileName);
}

function getFakeStorageFilePath (fileName) {
    return path.resolve(FAKE_STORAGE_PATH + fileName);
}

function getRealFilePath (fileName) {
    return path.resolve(SRC_PATH + fileName);
}

function compareFileContents (path1, path2) {
    return expect(fs.readFileSync(path1).toString()).eql(fs.readFileSync(path2).toString());
}

function checkFileExistence (path) {
    expect(fs.existsSync(path)).to.be.true;
}

function checkError (result, expectedPath) {
    expect(result.err.indexOf('ENOENT')).not.eql(-1);
    expect(result.path).eql(expectedPath);
}

function checkFileData (result, srcFileName, srcFilePath) {
    expect(result.data).eql(fs.readFileSync(srcFilePath).toString('base64'));
    expect(result.info.name).eql(srcFileName);
    expect(result.info.type).eql(mime.lookup(srcFilePath));
    expect(result.info.lastModifiedDate).eql(fs.statSync(srcFilePath).mtime);
}

describe('Upload Storage', function () {
    it('Store file', function (done) {
        var srcFilePath     = getRealFilePath('file-to-upload.txt');
        var storageFilePath = getStorageFilePath('file-to-upload.txt');

        clientEmulator.storing(session, ['file-to-upload.txt'], [srcFilePath]).then(function (result) {
            expect(result).to.be.null;
            checkFileExistence(storageFilePath);
            compareFileContents(storageFilePath, srcFilePath);

            fs.unlinkSync(storageFilePath);

            done();
        });
    });

    it('Store file in a non-existent storage folder', function (done) {
        var srcFilePath         = getRealFilePath('file-to-upload.txt');
        var fakeStorageFilePath = getFakeStorageFilePath('file-to-upload.txt');

        clientEmulator.storing(fakeStorageSession, ['file-to-upload.txt'], [srcFilePath]).then(function (result) {
            expect(result.length).eql(1);
            checkError(result[0], fakeStorageFilePath);
            done();
        });
    });

    it('Get file', function (done) {
        var storageFilePath = getStorageFilePath('uploaded-file.txt');

        clientEmulator.getting(session, ['uploaded-file.txt']).then(function (result) {
            expect(result.length).eql(1);
            checkFileData(result[0], 'uploaded-file.txt', storageFilePath);
            done();
        });
    });

    it('Try to get non-existent file from the storage', function (done) {
        var fakeStorageFilePath = getStorageFilePath('fake-file.txt');

        clientEmulator.getting(session, ['fake-file.txt']).then(function (result) {
            expect(result.length).eql(1);
            checkError(result[0], fakeStorageFilePath);
            done();
        });
    });

    it('Store/get multiple files', function (done) {
        var file1Path        = getRealFilePath('expected.formdata');
        var file2Path        = getRealFilePath('src.formdata');
        var file1StoragePath = getStorageFilePath('expected.formdata');
        var file2StoragePath = getStorageFilePath('src.formdata');

        clientEmulator.storing(session, ['expected.formdata', 'src.formdata'], [file1Path, file2Path]).then(function (result) {
            expect(result).to.be.null;
            checkFileExistence(file1StoragePath);
            checkFileExistence(file2StoragePath);
            compareFileContents(file1StoragePath, file1Path);
            compareFileContents(file2StoragePath, file2Path);

            clientEmulator.getting(session, ['expected.formdata', 'src.formdata']).then(function (result) {
                expect(result.length).eql(2);
                checkFileData(result[0], 'expected.formdata', file1StoragePath);
                checkFileData(result[1], 'src.formdata', file2StoragePath);

                fs.unlinkSync(file1StoragePath);
                fs.unlinkSync(file2StoragePath);

                done();
            });
        });
    });

    it('Try to get multiple files from the storage with error', function (done) {
        var fakeFileStoragePath = getStorageFilePath('fake-file.txt');
        var realFileStoragePath = getStorageFilePath('uploaded-file.txt');

        clientEmulator.getting(session, ['fake-file.txt', 'uploaded-file.txt']).then(function (result) {
            expect(result.length).eql(2);
            checkError(result[0], fakeFileStoragePath);
            checkFileData(result[1], 'uploaded-file.txt', realFileStoragePath);
            done();
        });
    });
});
