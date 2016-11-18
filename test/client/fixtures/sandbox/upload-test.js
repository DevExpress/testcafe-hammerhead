var COMMAND           = hammerhead.get('../session/command');
var UploadInfoManager = hammerhead.get('./sandbox/upload/info-manager');
var hiddenInfo        = hammerhead.get('./sandbox/upload/hidden-info');
var listeningContext  = hammerhead.get('./sandbox/event/listening-context');
var INTERNAL_PROPS    = hammerhead.get('../processing/dom/internal-properties');

var Promise        = hammerhead.Promise;
var transport      = hammerhead.transport;
var browserUtils   = hammerhead.utils.browser;
var uploadSandbox  = hammerhead.sandbox.upload;
var infoManager    = hammerhead.sandbox.upload.infoManager;
var eventSimulator = hammerhead.sandbox.event.eventSimulator;

// ----- Server API mock ---------
// Virtual file system:
//   - file.txt
//   - folder
//      - file.png

var files = [
    {
        paths: ['file.txt', './file.txt'],
        file:  {
            data: 'dGVzdA==',
            info: {
                lastModifiedDate: Date.now(),
                name:             'file.txt',
                type:             'text/plain'
            }
        }
    },
    {
        paths: ['./folder/file.png', 'folder/file.png'],
        file:  {
            data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAadEVYdFNvZnR3YXJlAFBhaW50Lk5FVCB2My41LjEwMPRyoQAAAAxJREFUGFdj+L99OwAFJgJueSUNaAAAAABJRU5ErkJggg==',
            info: {
                lastModifiedDate: Date.now(),
                name:             'file.png',
                type:             'image/png'
            }
        }
    }
];

var storedAsyncServiceMsg = transport.asyncServiceMsg;

QUnit.testStart(function () {
    transport.asyncServiceMsg = overridedAsyncServiceMsg;
});

QUnit.testDone(function () {
    transport.asyncServiceMsg = storedAsyncServiceMsg;
});

function overridedAsyncServiceMsg (msg) {
    return new Promise(function (resolve) {
        switch (msg.cmd) {
            case COMMAND.getUploadedFiles:
                resolve(getFilesInfo(msg.filePaths));
                break;
            case COMMAND.uploadFiles:
                resolve(uploadFiles(msg.data, msg.fileNames));
                break;
            default:
                return storedAsyncServiceMsg.call(transport, msg);
        }

        return null;
    });
}

function uploadFiles (data, filePaths) {
    var result = [];

    for (var i = 0; i < filePaths.length; i++) {
        if (filePaths[i] === 'error')
            result.push({ err: 34 });
        else {
            result.push({
                paths: [filePaths[i]],
                file:  data[i]
            });
        }
    }

    files = files.concat(result);

    return result;
}

function getFilesInfo (filePaths) {
    var result = [];

    for (var i = 0; i < filePaths.length; i++) {
        var res = null;

        for (var j = 0; j < files.length; j++) {
            if (files[j].paths.indexOf(filePaths[i]) !== -1)
                res = files[j].file;
        }

        result.push(res || { err: 34 });
    }

    return result;
}
// -------------------------------
function getInputMock (fileNames) {
    var value = fileNames.join(',');

    var fileListWrapper = fileNames.map(function (name) {
        var file = new Blob(['123'], { type: 'image/png' });

        file.name             = name;
        file.lastModifiedDate = Date.now();

        return file;
    });

    fileListWrapper.item = function (index) {
        return this[index];
    };

    var inputMock = {
        value:         value,
        files:         fileListWrapper,
        tagName:       'input',
        type:          'file',
        nodeName:      'input',
        dispatchEvent: function () {
        }
    };

    inputMock[INTERNAL_PROPS.processedContext] = window;

    return inputMock;
}

function getFiles (filesInfo) {
    var result = [];

    for (var i = 0; i < filesInfo.length; i++) {
        result.push({
            base64: filesInfo[i].data,
            type:   filesInfo[i].info.type,
            name:   filesInfo[i].info.name
        });
    }

    return result;
}

module('hidden info');

test('get/set upload info', function () {
    var fileInputWithoutForm = $('<input type="file">')[0];
    var fileInputWithForm    = $('<form><input type="file"></form>').children()[0];
    var form                 = fileInputWithForm.parentNode;

    hiddenInfo.setFormInfo(fileInputWithoutForm, [
        { fileProperties: 'value' }
    ]);

    hiddenInfo.setFormInfo(fileInputWithForm, [
        { otherFileProperties1: 'otherValue1' },
        { otherFileProperties2: 'otherValue2' }
    ]);

    var uploadInfoWithoutForm = hiddenInfo.getFormInfo(fileInputWithoutForm);
    var uploadInfoWithForm    = hiddenInfo.getFormInfo(fileInputWithForm);

    strictEqual(uploadInfoWithoutForm, null);
    strictEqual(uploadInfoWithForm.length, 2);
    strictEqual(uploadInfoWithForm[0].otherFileProperties1, 'otherValue1');
    strictEqual(uploadInfoWithForm[1].otherFileProperties2, 'otherValue2');

    hiddenInfo.setFormInfo($('<input type="file">').appendTo(form)[0], [
        { otherFileProperties3: 'otherValue3' }
    ]);

    uploadInfoWithForm = hiddenInfo.getFormInfo(fileInputWithForm);

    strictEqual(uploadInfoWithForm.length, 1);
    strictEqual(uploadInfoWithForm[0].otherFileProperties3, 'otherValue3');
    strictEqual(form.children.length, 3);
    strictEqual(form.querySelectorAll('[type="hidden"]').length, 1);
    strictEqual(form.querySelectorAll('[type="hidden"]')[0].value, JSON.stringify(uploadInfoWithForm));
});

test('add/remove input info', function () {
    var form = $([
        '<form>',
        '    <input type="file" name="test1" id="id1">',
        '    <input type="file" name="test2" id="id2">',
        '</form>'
    ].join(''));

    var fileInput1 = form.children()[0];
    var fileInput2 = form.children()[1];
    var formInfo   = hiddenInfo.getFormInfo(fileInput1);

    strictEqual(formInfo.length, 2);
    strictEqual(formInfo[0].files.length, 0);
    strictEqual(formInfo[1].files.length, 0);

    hiddenInfo.addInputInfo(fileInput1, getFiles(getFilesInfo(['file.txt', 'folder/file.png'])), 'file.txt');
    hiddenInfo.addInputInfo(fileInput2, getFiles(getFilesInfo(['folder/file.png'])), 'file.png');

    formInfo = hiddenInfo.getFormInfo(fileInput1);

    strictEqual(formInfo.length, 2);
    strictEqual(formInfo[0].value, 'file.txt');
    strictEqual(formInfo[0].name, 'test1');
    strictEqual(formInfo[0].files.length, 2);
    strictEqual(formInfo[0].files[0].name, 'file.txt');
    strictEqual(formInfo[0].files[1].name, 'file.png');
    strictEqual(formInfo[1].value, 'file.png');
    strictEqual(formInfo[1].name, 'test2');
    strictEqual(formInfo[1].files.length, 1);
    strictEqual(formInfo[1].files[0].name, 'file.png');

    hiddenInfo.removeInputInfo(fileInput1);

    formInfo = hiddenInfo.getFormInfo(fileInput1);

    strictEqual(formInfo.length, 1);
    strictEqual(formInfo[0].value, 'file.png');
    strictEqual(formInfo[0].name, 'test2');
    strictEqual(formInfo[0].files.length, 1);
    strictEqual(formInfo[0].files[0].name, 'file.png');

    hiddenInfo.removeInputInfo(fileInput2);

    formInfo = hiddenInfo.getFormInfo(fileInput1);

    strictEqual(formInfo.length, 0);
});

asyncTest('transfer input element between forms', function () {
    var formEl1          = $('<form><input type="file"></form>')[0];
    var formEl2          = $('<form>')[0];
    var inputEl          = formEl1.firstChild;
    var div              = document.createElement('div');
    var testHiddenInfo   = null;
    var parsedHiddenInfo = null;

    strictEqual(formEl1.children.length, 2, 'Hidden input in form1 is present');
    strictEqual(formEl2.children.length, 0, 'Hidden input in form2 is missing');

    uploadSandbox.doUpload(inputEl, ['./file.txt'])
        .then(function () {
            testHiddenInfo   = formEl1.children[1].value;
            parsedHiddenInfo = JSON.parse(testHiddenInfo);

            strictEqual(parsedHiddenInfo[0].files.length, 1, 'Hidden info contains 1 file');
            strictEqual(parsedHiddenInfo[0].files[0].name, 'file.txt', 'File name is "file.txt"');
            strictEqual(parsedHiddenInfo[0].files[0].type, 'text/plain', 'File type is "text/plain"');
            strictEqual(formEl2.children.length, 0, 'Hidden input in form2 is missing');

            formEl1.removeChild(inputEl);
            strictEqual(formEl1.children[0].value, '[]', 'Hidden info in form1 is empty');
            strictEqual(formEl2.children.length, 0, 'Hidden input in form2 is missing');

            formEl2.appendChild(inputEl);
            strictEqual(formEl1.children[0].value, '[]', 'Hidden info in form1 is empty');
            strictEqual(formEl2.children[1].value, testHiddenInfo, 'Hidden input in form2 contains file info');

            formEl2.removeChild(inputEl);
            strictEqual(formEl1.children[0].value, '[]', 'Hidden info in form1 is empty');
            strictEqual(formEl2.children[0].value, '[]', 'Hidden info in form2 is empty');

            formEl1.insertBefore(inputEl, formEl1.firstChild);
            strictEqual(formEl1.children[1].value, testHiddenInfo, 'Hidden input in form1 contains file info');
            strictEqual(formEl2.children[0].value, '[]', 'Hidden info in form2 is empty');

            formEl1.removeChild(inputEl);
            div.appendChild(inputEl);
            strictEqual(formEl1.children[0].value, '[]', 'Hidden info in form1 is empty');
            strictEqual(formEl2.children[0].value, '[]', 'Hidden info in form2 is empty');

            formEl1.insertBefore(div, formEl1.firstChild);
            strictEqual(formEl1.children[1].value, testHiddenInfo, 'Hidden input in form1 contains file info');
            strictEqual(formEl2.children[0].value, '[]', 'Hidden info in form2 is empty');

            formEl1.removeChild(div);
            strictEqual(formEl1.children[0].value, '[]', 'Hidden info in form1 is empty');
            strictEqual(formEl2.children[0].value, '[]', 'Hidden info in form2 is empty');

            start();
        });
});

module('info manager');

test('set/clear info', function () {
    var form = $([
        '<form>',
        '    <input type="file" name="test1" id="id1">',
        '    <input type="file" name="test2" id="id2">',
        '</form>'
    ].join(''));

    var fileInput1    = form.children()[0];
    var fileInput2    = form.children()[1];
    var textFileInfo  = getFilesInfo(['file.txt']);
    var imageFileInfo = getFilesInfo(['folder/file.png']);

    strictEqual(infoManager.getUploadInfo(fileInput1), null);
    strictEqual(infoManager.getUploadInfo(fileInput2), null);

    infoManager.setUploadInfo(fileInput1, imageFileInfo, 'file.png');
    strictEqual(JSON.stringify(infoManager.getUploadInfo(fileInput1).files), JSON.stringify(imageFileInfo));
    strictEqual(infoManager.getUploadInfo(fileInput2), null);

    infoManager.setUploadInfo(fileInput1, textFileInfo, 'file.txt');
    strictEqual(JSON.stringify(infoManager.getUploadInfo(fileInput1).files), JSON.stringify(textFileInfo));
    strictEqual(infoManager.getUploadInfo(fileInput2), null);

    infoManager.setUploadInfo(fileInput2, imageFileInfo, 'file.png');
    strictEqual(JSON.stringify(infoManager.getUploadInfo(fileInput1).files), JSON.stringify(textFileInfo));
    strictEqual(JSON.stringify(infoManager.getUploadInfo(fileInput2).files), JSON.stringify(imageFileInfo));

    infoManager.clearUploadInfo(fileInput2);
    strictEqual(JSON.stringify(infoManager.getUploadInfo(fileInput1).files), JSON.stringify(textFileInfo));
    strictEqual(infoManager.getUploadInfo(fileInput2).files.length, 0);

    infoManager.clearUploadInfo(fileInput1);
    strictEqual(infoManager.getUploadInfo(fileInput1).files.length, 0);
    strictEqual(infoManager.getUploadInfo(fileInput2).files.length, 0);
});

test('format value', function () {
    var formatValueOneFile   = UploadInfoManager.formatValue(['text.pdf']);
    var formatValueMultiFile = UploadInfoManager.formatValue(['text.txt', 'doc.doc']);

    if (browserUtils.isIE9 || browserUtils.isIE10 || browserUtils.isWebKit)
        strictEqual(formatValueOneFile, 'C:\\fakepath\\text.pdf');
    else
        strictEqual(formatValueOneFile, 'text.pdf');

    if (browserUtils.isIE9 || browserUtils.isIE10)
        strictEqual(formatValueMultiFile, 'C:\\fakepath\\text.txt, C:\\fakepath\\doc.doc');
    else if (browserUtils.isWebKit)
        strictEqual(formatValueMultiFile, 'C:\\fakepath\\text.txt');
    else
        strictEqual(formatValueMultiFile, 'text.txt');
});

module('server errs');

asyncTest('upload error', function () {
    var input = $('<input type="file">')[0];

    uploadSandbox.doUpload(input, './err_file.txt')
        .then(function (errs) {
            strictEqual(errs.length, 1);
            strictEqual(errs[0].err, 34);

            return uploadSandbox.doUpload(input, ['./err_file1.txt', './file.txt', './err_file2.txt']);
        })
        .then(function (errs) {
            strictEqual(errs.length, 2);
            strictEqual(errs[0].err, 34);
            strictEqual(errs[1].err, 34);

            start();
        });
});

if (!browserUtils.isIE9) {
    asyncTest('get uploaded file error: single file', function () {
        var stFiles      = files;
        var inputMock    = getInputMock(['error']);
        var eventHandler = function (err) {
            strictEqual(err.length, 1);
            strictEqual(err[0].err, 34);

            uploadSandbox.off(uploadSandbox.END_FILE_UPLOADING_EVENT, eventHandler);
            files = stFiles;

            start();
        };

        uploadSandbox.on(uploadSandbox.END_FILE_UPLOADING_EVENT, eventHandler);
        listeningContext.getElementCtx(window).change.internalHandlers[1].call(inputMock, { target: inputMock });
    });

    asyncTest('get uploaded file error: multi file', function () {
        var stFiles      = files;
        var inputMock    = getInputMock(['file1.txt', 'error', 'file2.txt']);
        var eventHandler = function (err) {
            strictEqual(err.length, 3);
            strictEqual(err[1].err, 34);
            ok(!err[0].err);
            ok(!err[2].err);

            uploadSandbox.off(uploadSandbox.END_FILE_UPLOADING_EVENT, eventHandler);
            files = stFiles;

            start();
        };

        uploadSandbox.on(uploadSandbox.END_FILE_UPLOADING_EVENT, eventHandler);
        listeningContext.getElementCtx(window).change.internalHandlers[1].call(inputMock, { target: inputMock });
    });
}

module('upload');

test('set value', function () {
    var fileInput = $('<input type="file">')[0];

    strictEqual(fileInput.value, '');

    eval(processScript('fileInput.value = "d:/text.test"'));

    strictEqual(fileInput.value, '');
});

asyncTest('set empty value', function () {
    var fileInput = $('<input type="file" name="test" id="id">')[0];
    var value     = '';
    var testFiles = null;

    eval(processScript('value = fileInput.value; testFiles = fileInput.files'));

    strictEqual(value, '');

    if (browserUtils.isIE9)
        strictEqual(typeof testFiles, 'undefined');
    else
        strictEqual(testFiles.length, 0);

    uploadSandbox.doUpload(fileInput, ['./file.txt'])
        .then(function () {
            eval(processScript('value = fileInput.value; testFiles = fileInput.files'));

            if (browserUtils.isWebKit || browserUtils.isIE9 || browserUtils.isIE10)
                strictEqual(value, 'C:\\fakepath\\file.txt');
            else
                strictEqual(value, 'file.txt');

            if (browserUtils.isIE9)
                strictEqual(typeof testFiles, 'undefined');
            else
                strictEqual(testFiles.length, 1);

            eval(processScript('fileInput.value = "";value = fileInput.value; testFiles = fileInput.files'));

            strictEqual(value, '');

            if (browserUtils.isIE9)
                strictEqual(typeof testFiles, 'undefined');
            else
                strictEqual(testFiles.length, 0);

            start();
        });
});

asyncTest('repeated select file', function () {
    var fileInput = $('<input type="file" name="test" id="id">')[0];
    var value     = '';
    var testFiles = null;

    uploadSandbox.doUpload(fileInput, './file.txt')
        .then(function () {
            eval(processScript('value = fileInput.value; testFiles = fileInput.files'));

            if (browserUtils.isWebKit || browserUtils.isIE9 || browserUtils.isIE10)
                strictEqual(value, 'C:\\fakepath\\file.txt');
            else
                strictEqual(value, 'file.txt');

            if (browserUtils.isIE9)
                strictEqual(typeof testFiles, 'undefined');
            else
                strictEqual(testFiles[0].name, 'file.txt');

            return uploadSandbox.doUpload(fileInput, 'folder/file.png');
        })
        .then(function () {
            eval(processScript('value = fileInput.value; testFiles = fileInput.files'));

            if (browserUtils.isWebKit || browserUtils.isIE9 || browserUtils.isIE10)
                strictEqual(value, 'C:\\fakepath\\file.png');
            else
                strictEqual(value, 'file.png');

            if (browserUtils.isIE9)
                strictEqual(typeof testFiles, 'undefined');
            else
                strictEqual(testFiles[0].name, 'file.png');

            start();
        });
});

asyncTest('change event', function () {
    var fileInput = $('<input type="file" name="test" id="777">')[0];

    fileInput.onchange = function () {
        var value     = '';
        var testFiles = null;

        eval(processScript('value = fileInput.value; testFiles = fileInput.files'));

        if (browserUtils.isWebKit || browserUtils.isIE9 || browserUtils.isIE10)
            strictEqual(value, 'C:\\fakepath\\file.txt');
        else
            strictEqual(value, 'file.txt');

        if (browserUtils.isIE9)
            strictEqual(typeof testFiles, 'undefined');
        else
            strictEqual(testFiles.length, 1);

        start();
    };

    uploadSandbox.doUpload(fileInput, './file.txt');
});

asyncTest('multi-select files', function () {
    var fileInput = $('<input type="file" name="test" id="id">')[0];
    var value     = '';
    var testFiles = null;

    uploadSandbox.doUpload(fileInput, ['./file.txt', 'folder/file.png'])
        .then(function () {
            eval(processScript('value = fileInput.value; testFiles = fileInput.files'));

            if (browserUtils.isIE9 || browserUtils.isIE10)
                strictEqual(value, 'C:\\fakepath\\file.txt, C:\\fakepath\\file.png');
            else if (browserUtils.isWebKit)
                strictEqual(value, 'C:\\fakepath\\file.txt');
            else
                strictEqual(value, 'file.txt');

            if (browserUtils.isIE9)
                strictEqual(typeof testFiles, 'undefined');
            else
                strictEqual(testFiles.length, 2);

            start();
        });
});

asyncTest('get file info from iframe', function () {
    var fileInput = document.createElement('input');

    fileInput.id   = 'uploadTestIframe';
    fileInput.type = 'file';
    fileInput.name = 'test';
    document.body.appendChild(fileInput);

    uploadSandbox.doUpload(fileInput, './file.txt')
        .then(function () {
            var iframe = document.createElement('iframe');

            window.addEventListener('message', function (e) {
                var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;

                if (!browserUtils.isIE9) {
                    strictEqual(data.filesLength, 1);
                    strictEqual(data.fileName, 'file.txt');
                    strictEqual(data.fileType, 'text/plain');
                }

                if (browserUtils.isWebKit || browserUtils.isIE9 || browserUtils.isIE10)
                    strictEqual(data.value, 'C:\\fakepath\\file.txt');
                else
                    strictEqual(data.value, 'file.txt');

                fileInput.parentNode.removeChild(fileInput);
                iframe.parentNode.removeChild(iframe);

                start();
            });

            iframe.src = window.QUnitGlobals.getResourceUrl('../../data/upload/iframe.html');
            document.body.appendChild(iframe);
        });
});

asyncTest('input.value getter', function () {
    var fileInput = $('<input type="file" name="test" id="id">')[0];

    uploadSandbox.doUpload(fileInput, ['./file.txt'])
        .then(function () {
            var fileInputValue = getProperty(fileInput, 'value');

            ok(fileInputValue.indexOf('file.txt') !== -1);
            start();
        });
});

module('add / remove element');

test('file input', function () {
    var form  = document.createElement('form');
    var input = document.createElement('input');

    document.body.appendChild(form);
    input.setAttribute('type', 'file');
    input.name = 'fileInput1';
    form.appendChild(input);

    var inputHiddenInfo = hiddenInfo.getFormInfo(input);

    strictEqual(inputHiddenInfo.length, 1);
    strictEqual(inputHiddenInfo[0].name, 'fileInput1');
    strictEqual(inputHiddenInfo[0].files.length, 0);

    form.parentNode.removeChild(form);

    inputHiddenInfo = hiddenInfo.getFormInfo(input);
    strictEqual(inputHiddenInfo.length, 0);
});

test('file inputs inside container', function () {
    var form      = document.createElement('form');
    var container = document.createElement('div');
    var input1    = document.createElement('input');
    var input2    = document.createElement('input');

    document.body.appendChild(form);
    input1.setAttribute('type', 'file');
    input1.id = 'fileInput1';
    input1.name = 'fileInput1';
    input2.setAttribute('type', 'file');
    input2.id = 'fileInput2';
    input2.name = 'fileInput2';
    container.appendChild(input1);
    container.appendChild(input2);
    form.appendChild(container);

    var inputHiddenInfo = hiddenInfo.getFormInfo(input1);

    strictEqual(inputHiddenInfo.length, 2);
    strictEqual(inputHiddenInfo[0].name, 'fileInput1');
    strictEqual(inputHiddenInfo[0].files.length, 0);
    strictEqual(inputHiddenInfo[1].name, 'fileInput2');
    strictEqual(inputHiddenInfo[1].files.length, 0);

    form.parentNode.removeChild(form);
    inputHiddenInfo = hiddenInfo.getFormInfo(input1);
    strictEqual(inputHiddenInfo.length, 0);
});

test('text node', function () {
    var form     = document.createElement('form');
    var textNode = document.createTextNode('text');

    document.body.appendChild(form);
    textNode.name = 'fileInput1';
    form.appendChild(textNode);

    var inputHiddenInfo = hiddenInfo.getFormInfo(textNode);

    ok(!inputHiddenInfo);

    form.parentNode.removeChild(form);
});

test('document fragment', function () {
    var form   = null;
    var input1 = null;

    var createTestDocumentFragment = function () {
        var documentFragment = document.createDocumentFragment();
        var input2           = document.createElement('input');

        form = document.createElement('form');
        input1 = document.createElement('input');
        input1.setAttribute('type', 'file');
        input1.id = 'fileInput1';
        input1.name = 'fileInput1';
        input2.setAttribute('type', 'file');
        input2.id = 'fileInput2';
        input2.name = 'fileInput2';
        form.appendChild(input1);
        form.appendChild(input2);
        form.id = 'testFormForDocumentFragment';
        documentFragment.appendChild(form);

        return documentFragment;
    };

    var checkHiddenInfo = function () {
        var inputHiddenInfo = hiddenInfo.getFormInfo(input1);

        strictEqual(inputHiddenInfo.length, 2);
        strictEqual(inputHiddenInfo[0].name, 'fileInput1');
        strictEqual(inputHiddenInfo[0].files.length, 0);
        strictEqual(inputHiddenInfo[1].name, 'fileInput2');
        strictEqual(inputHiddenInfo[1].files.length, 0);

        form.parentNode.removeChild(form);
        inputHiddenInfo = hiddenInfo.getFormInfo(input1);
        strictEqual(inputHiddenInfo.length, 0);
    };

    var documentFragment = createTestDocumentFragment();

    document.body.appendChild(documentFragment);
    checkHiddenInfo();

    documentFragment = createTestDocumentFragment();
    document.body.insertBefore(documentFragment, null);
    checkHiddenInfo();
});

module('regression');

if (browserUtils.isIE) {
    asyncTest("prevent the browser's open file dialog (T394838)", function () {
        var div                   = document.createElement('div');
        var fileInput             = document.createElement('input');
        var isInputAlreadyClicked = false;

        fileInput.type = 'file';
        div.appendChild(fileInput);
        document.body.appendChild(div);

        fileInput.addEventListener('click', function (e) {
            ok(e.defaultPrevented);

            if (isInputAlreadyClicked || !browserUtils.isMSEdge) {
                document.body.removeChild(div);
                start();
            }

            isInputAlreadyClicked = true;
        }, true);

        div.addEventListener('click', function () {
            fileInput.click();
        }, true);

        eventSimulator.click(fileInput);
    });
}

if (window.FileList) {
    test('the "instanceof FileList" operation works correctly with FileListWrapper instances (GH-689)', function () {
        var input = document.createElement('input');

        input.type = 'file';

        ok(getProperty(input, 'files') instanceof FileList);
    });
}
