import INTERNAL_ATTRS from '../../../processing/dom/internal-attributes';
import nativeMethods from '../native-methods';

// NOTE: We should avoid using native object prototype methods,
// since they can be overriden by the client code. (GH-245)
var arraySlice = Array.prototype.slice;

function createInput (form) {
    var hiddenInput = nativeMethods.createElement.call(document, 'input');

    hiddenInput.type  = 'hidden';
    hiddenInput.name  = INTERNAL_ATTRS.uploadInfoHiddenInputName;
    hiddenInput.value = '[]';

    nativeMethods.appendChild.call(form, hiddenInput);

    return hiddenInput;
}

function getInput (form) {
    var inputSelector = '[name="' + INTERNAL_ATTRS.uploadInfoHiddenInputName + '"]';

    return nativeMethods.elementQuerySelector.call(form, inputSelector) || createInput(form);
}

function indexOf (info, input) {
    for (var index = 0; index < info.length; index++) {
        if (info[index].id === input.id || info[index].name === input.name)
            return index;
    }

    return -1;
}

export function addInputInfo (input, fileList, value) {
    var formInfo = getFormInfo(input);

    if (formInfo) {
        var files = [];

        fileList = arraySlice.call(fileList);

        for (var i = 0, len = fileList.length; i < len; i++) {
            var file = fileList[i];

            files.push({
                name: file.name,
                type: file.type,
                data: file.base64
            });
        }

        var inputInfoIndex = indexOf(formInfo, input);
        var inputInfo      = {
            id:    input.id,
            name:  input.name,
            files: files,
            value: value
        };

        if (inputInfoIndex === -1)
            formInfo.push(inputInfo);
        else
            formInfo[inputInfoIndex] = inputInfo;

        setFormInfo(input, formInfo);
    }
}

export function getFormInfo (input) {
    return input.form ? JSON.parse(getInput(input.form).value) : null;
}

export function setFormInfo (input, info) {
    if (input.form) {
        var hiddenInput = getInput(input.form);

        hiddenInput.value = JSON.stringify(info);
    }
}

export function removeInputInfo (input) {
    var uploadInfo = getFormInfo(input);

    if (uploadInfo) {
        var inputInfoIndex = indexOf(uploadInfo, input);

        if (inputInfoIndex !== -1) {
            uploadInfo.splice(inputInfoIndex, 1);
            setFormInfo(input, uploadInfo);

            return true;
        }
    }

    return false;
}
