const COMMAND           = hammerhead.SESSION_COMMAND;
const UploadInfoManager = hammerhead.sandboxUtils.UploadInfoManager;
const FileListWrapper   = hammerhead.sandboxUtils.FileListWrapper;
const hiddenInfo        = hammerhead.sandboxUtils.hiddenInfo;
const UploadSandbox     = hammerhead.sandboxes.UploadSandbox;
const listeningContext  = hammerhead.sandboxUtils.listeningContext;
const INTERNAL_PROPS    = hammerhead.PROCESSING_INSTRUCTIONS.dom.internal_props;
const settings          = hammerhead.settings;

const Promise       = hammerhead.Promise;
const transport     = hammerhead.transport;
const uploadSandbox = hammerhead.sandbox.upload;
const infoManager   = hammerhead.sandbox.upload.infoManager;
const nativeMethods = hammerhead.nativeMethods;

const browserUtils  = hammerhead.utils.browser;
const isChrome      = browserUtils.isChrome;
const isFirefox     = browserUtils.isFirefox;
const isSafari      = browserUtils.isSafari;
const isMacPlatform = browserUtils.isMacPlatform;

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
                lastModifiedDate: new Date(Date.now()),
                name:             'file.txt',
                type:             'text/plain',
            },
        },
    },
    {
        paths: ['./folder/file.png', 'folder/file.png'],
        file:  {
            data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAadEVYdFNvZnR3YXJlAFBhaW50Lk5FVCB2My41LjEwMPRyoQAAAAxJREFUGFdj+L99OwAFJgJueSUNaAAAAABJRU5ErkJggg==',
            info: {
                lastModifiedDate: new Date(Date.now()),
                name:             'file.png',
                type:             'image/png',
            },
        },
    },
];

var storedAsyncServiceMsg = transport.asyncServiceMsg;

QUnit.testStart(function () {
    transport.asyncServiceMsg = overriddenAsyncServiceMsg;
});

QUnit.testDone(function () {
    transport.asyncServiceMsg = storedAsyncServiceMsg;
});

function overriddenAsyncServiceMsg (msg) {
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
                file:  data[i],
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
        var file = new File(['123'], name, { type: 'image/png', lastModified: Date.now() });

        file.name = name;

        if (!nativeMethods.File)
            file.lastModifiedDate = new Date(Date.now());

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
        },
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
            name:   filesInfo[i].info.name,
        });
    }

    return result;
}

module('hidden info');

test('hidden input should not affect both the length/count value and the elements order (GH-2009)', function () {
    var form   = document.createElement('form');
    var input1 = document.createElement('input');
    var input2 = document.createElement('input');

    input1.id = 'input1';
    input2.id = 'input2';

    document.body.appendChild(form);
    form.appendChild(input1);

    var expectedElements = [input1, input2]; // eslint-disable-line @typescript-eslint/no-unused-vars

    function checkElements (iterableObj) {
        var index = 0;

        for (var el of iterableObj) {
            strictEqual(el, expectedElements[index]);
            index++;
        }
    }

    function checkLength (expeсted) {
        strictEqual(form.elements.length, expeсted);
        strictEqual(form.children.length, expeсted);
        strictEqual(form.childNodes.length, expeсted);
        strictEqual(form.childElementCount, expeсted);
    }

    return uploadSandbox.doUpload(input1, './file.txt')
        .then(function () {
            checkLength(1);

            strictEqual(form.firstChild, form.lastChild);
            strictEqual(form.firstElementChild, form.lastElementChild);


            form.appendChild(input2);

            checkLength(2);

            checkElements(form.elements);
            checkElements(form.children);
            checkElements(form.childNodes);

            strictEqual(form.firstChild, input1);
            strictEqual(form.firstElementChild, input1);
            strictEqual(form.lastChild, input2);
            strictEqual(form.lastElementChild, input2);

            form.parentNode.removeChild(form);
        });
});

test('hidden input should not affect on getting element by index in multilevel form', function () {
    var form   = document.createElement('form');

    var input1 = $('<label><input type="file"></label>')[0];
    var input2 = $('<input type="checkbox">')[0];

    document.body.appendChild(form);

    form.appendChild(input1);
    form.appendChild(input2);

    strictEqual(input1, form.childNodes[0]);
    strictEqual(input2, form.childNodes[1]);

    form.parentNode.removeChild(form);
});

test('get/set upload info', function () {
    var fileInputWithoutForm = $('<input type="file">')[0];
    var fileInputWithForm    = $('<form><input type="file"></form>').children()[0];
    var form                 = fileInputWithForm.parentNode;

    hiddenInfo.setFormInfo(fileInputWithoutForm, [
        { fileProperties: 'value' },
    ]);

    hiddenInfo.setFormInfo(fileInputWithForm, [
        { otherFileProperties1: 'otherValue1' },
        { otherFileProperties2: 'otherValue2' },
    ]);

    var uploadInfoWithoutForm = hiddenInfo.getFormInfo(fileInputWithoutForm);
    var uploadInfoWithForm    = hiddenInfo.getFormInfo(fileInputWithForm);

    strictEqual(uploadInfoWithoutForm, null);
    strictEqual(uploadInfoWithForm.length, 2);
    strictEqual(uploadInfoWithForm[0].otherFileProperties1, 'otherValue1');
    strictEqual(uploadInfoWithForm[1].otherFileProperties2, 'otherValue2');

    hiddenInfo.setFormInfo($('<input type="file">').appendTo(form)[0], [
        { otherFileProperties3: 'otherValue3' },
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
        '</form>',
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

test('transfer input element between forms', function () {
    var formEl1          = $('<form><input type="file"></form>')[0];
    var formEl2          = $('<form>')[0];
    var inputEl          = formEl1.firstChild;
    var div              = document.createElement('div');
    var testHiddenInfo   = null;
    var parsedHiddenInfo = null;

    strictEqual(formEl1.children.length, 2, 'Hidden input in form1 is present');
    strictEqual(formEl2.children.length, 0, 'Hidden input in form2 is missing');

    return uploadSandbox.doUpload(inputEl, ['./file.txt'])
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
        });
});

module('info manager');

test('set/clear info', function () {
    var form = $([
        '<form>',
        '    <input type="file" name="test1" id="id1">',
        '    <input type="file" name="test2" id="id2">',
        '</form>',
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
    const formatValueOneFile        = UploadInfoManager.formatValue(['text.pdf']);
    const formatValueMultiFile      = UploadInfoManager.formatValue(['text.txt', 'doc.doc']);
    const formatValueForWindowsPath = UploadInfoManager.formatValue(['C:\\users\\test-user\\text.txt']);

    strictEqual(formatValueOneFile, 'C:\\fakepath\\text.pdf');
    strictEqual(formatValueMultiFile, 'C:\\fakepath\\text.txt');
    strictEqual(formatValueForWindowsPath, 'C:\\fakepath\\text.txt');
});

module('server errs');

test('upload error', function () {
    var input = $('<input type="file">')[0];

    return uploadSandbox.doUpload(input, './err_file.txt')
        .then(function (errs) {
            strictEqual(errs.length, 1);
            strictEqual(errs[0].err, 34);

            return uploadSandbox.doUpload(input, ['./err_file1.txt', './file.txt', './err_file2.txt']);
        })
        .then(function (errs) {
            strictEqual(errs.length, 2);
            strictEqual(errs[0].err, 34);
            strictEqual(errs[1].err, 34);
        });
});

asyncTest('get uploaded file error: single file', function () {
    var stFiles                 = files;
    var storedObjectToString    = nativeMethods.objectToString;
    var storedInputFilesGetter  = nativeMethods.inputFilesGetter;
    var storedInputValueGetter  = nativeMethods.inputValueGetter;
    var storedEventTargetGetter = nativeMethods.eventTargetGetter;
    var inputMock               = getInputMock(['error']);
    var eventMock               = { target: inputMock };

    var eventHandler = function (err) {
        strictEqual(err.length, 1);
        strictEqual(err[0].err, 34);

        uploadSandbox.off(uploadSandbox.END_FILE_UPLOADING_EVENT, eventHandler);
        files = stFiles;

        nativeMethods.objectToString    = storedObjectToString;
        nativeMethods.inputFilesGetter  = storedInputFilesGetter;
        nativeMethods.inputValueGetter  = storedInputValueGetter;
        nativeMethods.eventTargetGetter = storedEventTargetGetter;

        start();
    };

    nativeMethods.objectToString = function () {
        if (this === inputMock || this === Object.getPrototypeOf(inputMock))
            return '[object HTMLInputElement]';

        return storedObjectToString.call(this);
    };

    nativeMethods.inputFilesGetter = function () {
        return inputMock.files;
    };

    nativeMethods.inputValueGetter = function () {
        return inputMock.value;
    };

    nativeMethods.eventTargetGetter = function () {
        if (this === eventMock)
            return inputMock;

        return storedEventTargetGetter.call(this);
    };

    uploadSandbox.on(uploadSandbox.END_FILE_UPLOADING_EVENT, eventHandler);
    listeningContext.getElementCtx(window).change.internalBeforeHandlers[1].call(inputMock, eventMock);
});

asyncTest('get uploaded file error: multi file', function () {
    var stFiles                 = files;
    var storedObjectToString    = nativeMethods.objectToString;
    var storedInputFilesGetter  = nativeMethods.inputFilesGetter;
    var storedInputValueGetter  = nativeMethods.inputValueGetter;
    var storedEventTargetGetter = nativeMethods.eventTargetGetter;
    var inputMock               = getInputMock(['file1.txt', 'error', 'file2.txt']);
    var eventMock               = { target: inputMock };

    var eventHandler = function (err) {
        strictEqual(err.length, 3);
        strictEqual(err[1].err, 34);
        ok(!err[0].err);
        ok(!err[2].err);

        uploadSandbox.off(uploadSandbox.END_FILE_UPLOADING_EVENT, eventHandler);
        files = stFiles;

        nativeMethods.objectToString    = storedObjectToString;
        nativeMethods.inputFilesGetter  = storedInputFilesGetter;
        nativeMethods.inputValueGetter  = storedInputValueGetter;
        nativeMethods.eventTargetGetter = storedEventTargetGetter;

        start();
    };

    nativeMethods.objectToString = function () {
        if (this === inputMock || this === Object.getPrototypeOf(inputMock))
            return '[object HTMLInputElement]';

        return storedObjectToString.call(this);
    };

    nativeMethods.inputFilesGetter = function () {
        return inputMock.files;
    };

    nativeMethods.inputValueGetter = function () {
        return inputMock.value;
    };

    nativeMethods.eventTargetGetter = function () {
        if (this === eventMock)
            return inputMock;

        return storedEventTargetGetter.call(this);
    };

    uploadSandbox.on(uploadSandbox.END_FILE_UPLOADING_EVENT, eventHandler);
    listeningContext.getElementCtx(window).change.internalBeforeHandlers[1].call(inputMock, eventMock);
});

module('upload');

test('set value', function () {
    var fileInput = $('<input type="file">')[0];

    strictEqual(fileInput.value, '');

    fileInput.value = 'd:/text.test';

    strictEqual(fileInput.value, '');
});

test('set empty value', function () {
    var fileInput = $('<input type="file" name="test" id="id">')[0];
    var value     = fileInput.value;
    var testFiles = fileInput.files;

    strictEqual(value, '');
    strictEqual(testFiles.length, 0);

    return uploadSandbox.doUpload(fileInput, ['./file.txt'])
        .then(function () {
            value     = fileInput.value;
            testFiles = fileInput.files;

            strictEqual(value, 'C:\\fakepath\\file.txt');
            strictEqual(testFiles.length, 1);

            fileInput.value = '';
            value           = fileInput.value;
            testFiles       = fileInput.files;

            strictEqual(value, '');
            strictEqual(testFiles.length, 0);
        });
});

test('repeated select file', function () {
    var fileInput = $('<input type="file" name="test" id="id">')[0];
    var value     = '';
    var testFiles = null;

    return uploadSandbox.doUpload(fileInput, './file.txt')
        .then(function () {
            value     = fileInput.value;
            testFiles = fileInput.files;

            strictEqual(value, 'C:\\fakepath\\file.txt');
            strictEqual(testFiles[0].name, 'file.txt');

            return uploadSandbox.doUpload(fileInput, 'folder/file.png');
        })
        .then(function () {
            value     = fileInput.value;
            testFiles = fileInput.files;

            strictEqual(value, 'C:\\fakepath\\file.png');
            strictEqual(testFiles[0].name, 'file.png');
        });
});

asyncTest('change event', function () {
    var fileInput = $('<input type="file" name="test" id="777">')[0];

    fileInput.onchange = function () {
        var value     = fileInput.value;
        var testFiles = fileInput.files;

        strictEqual(value, 'C:\\fakepath\\file.txt');
        strictEqual(testFiles.length, 1);

        start();
    };

    uploadSandbox.doUpload(fileInput, './file.txt');
});

test('change event in the case of another file selection (GH-2007)', function () {
    var changeEventCounter = 0;
    var fileInput          = document.createElement('input');

    fileInput.type = 'file';

    document.body.appendChild(fileInput);

    var changeHandler = function () {
        changeEventCounter++;
    };

    fileInput.onchange = changeHandler;

    return uploadSandbox.doUpload(fileInput, './file.txt')
        .then(function () {
            return uploadSandbox.doUpload(fileInput, 'folder/file.png');
        })
        .then(function () {
            strictEqual(changeEventCounter, 2);

            fileInput.parentNode.removeChild(fileInput);
        });
});

test('change event in the case of the same file/files selection (GH-1844)', function () {
    var needToRaiseChangeEvent = isFirefox || (isMacPlatform && isChrome || isSafari);
    var assertionsCount        = needToRaiseChangeEvent ? 4 : 0;

    expect(assertionsCount);

    var fileInput = $('<input type="file" name="test" id="777">')[0];

    var changeHandler = function () {
        ok(needToRaiseChangeEvent);
    };

    return uploadSandbox.doUpload(fileInput, './file.txt')
        .then(function () {
            fileInput.onchange = changeHandler;

            return uploadSandbox.doUpload(fileInput, './file.txt');
        })
        .then(function () {
            return uploadSandbox.doUpload(fileInput, ['./file.txt']);
        })
        .then(function () {
            fileInput.onchange = null;

            return uploadSandbox.doUpload(fileInput, ['folder/file.png', './file.txt']);
        })
        .then(function () {
            fileInput.onchange = changeHandler;

            return uploadSandbox.doUpload(fileInput, ['folder/file.png', './file.txt']);
        })
        .then(function () {
            return uploadSandbox.doUpload(fileInput, ['./file.txt', 'folder/file.png']);
        });
});

test('multi-select files', function () {
    var fileInput = $('<input type="file" name="test" id="id">')[0];
    var value     = '';
    var testFiles = null;

    return uploadSandbox.doUpload(fileInput, ['./file.txt', 'folder/file.png'])
        .then(function () {
            value     = fileInput.value;
            testFiles = fileInput.files;

            strictEqual(value, 'C:\\fakepath\\file.txt');
            strictEqual(testFiles.length, 2);
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
                var rawData = e.data;
                var data    = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

                strictEqual(data.filesLength, 1);
                strictEqual(data.fileName, 'file.txt');
                strictEqual(data.fileType, 'text/plain');
                strictEqual(data.value, 'C:\\fakepath\\file.txt');

                fileInput.parentNode.removeChild(fileInput);
                iframe.parentNode.removeChild(iframe);

                start();
            });

            iframe.src = getSameDomainPageUrl('../../data/upload/iframe.html');
            document.body.appendChild(iframe);
        });
});

test('input.value getter', function () {
    var fileInput = $('<input type="file" name="test" id="id">')[0];

    return uploadSandbox.doUpload(fileInput, ['./file.txt'])
        .then(function () {
            var fileInputValue = fileInput.value;

            ok(fileInputValue.indexOf('file.txt') !== -1);
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
    input1.id   = 'fileInput1';
    input1.name = 'fileInput1';
    input2.setAttribute('type', 'file');
    input2.id   = 'fileInput2';
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

        form   = document.createElement('form');
        input1 = document.createElement('input');
        input1.setAttribute('type', 'file');
        input1.id   = 'fileInput1';
        input1.name = 'fileInput1';
        input2.setAttribute('type', 'file');
        input2.id   = 'fileInput2';
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

if (window.FileList) {
    test('the "instanceof FileList" operation works correctly with FileListWrapper instances (GH-689)', function () {
        const input = document.createElement('input');

        input.type = 'file';

        ok(input.files instanceof FileList);
    });

    test('illegal invocation error on call `FileListWrapper.item` method (GH-1446)', function () {
        var input = document.createElement('input');

        input.type = 'file';

        var inputFiles = input.files;

        try {
            var item1 = inputFiles.item(0);

            notOk(item1);
        }
        catch (e) {
            ok(false, 'error is raised');
        }

    });

    module('FileListWrapper should work correctly if window.File and window.Blob are overridden (TC-GH-5647)', function () {
        test('File', function () {
            const storedFile = window.File;

            window.File = function () {
                throw new Error('File constructor is not supposed to be called');
            };

            const wrapper = FileListWrapper._createFileWrapper({
                info: {
                    size: 4,
                    type: 'text/plain',
                    name: 'correctName.txt',
                },
                data: 'MTIzDQo=',
            });

            ok(wrapper instanceof storedFile);

            window.File = storedFile;
        });

        test('Blob', function () {
            const storedBlob = window.Blob;

            window.Blob = function () {
                throw new Error('Blob constructor is not supposed to be called');
            };

            const wrapper = FileListWrapper._createFileWrapper({
                info: {
                    size: 4,
                    type: 'application/pdf',
                    name: 'correctName.pdf',
                },
                blob: new storedBlob(['pdf text'], { type: 'application/pdf' }), // eslint-disable-line new-cap
            });

            ok(wrapper instanceof storedBlob);

            window.Blob = storedBlob;
        });
    });
}

test('Should not prevent native upload dialog in the record mode (GH-2168)', function () {
    var uploadSand = new UploadSandbox({
        addInternalEventBeforeListener: function (el, events) {
            strictEqual(events.indexOf('click'), -1);
        },
    });

    settings.get().isRecordMode = true;

    uploadSand.attach(window);

    settings.get().isRecordMode = false;
});
