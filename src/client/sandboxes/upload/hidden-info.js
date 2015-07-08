import Const from '../../../const';

function createInput (form) {
    var hiddenInput = document.createElement('input');

    hiddenInput.type  = 'hidden';
    hiddenInput.name  = Const.UPLOAD_SANDBOX_HIDDEN_INPUT_NAME;
    hiddenInput.value = '[]';

    form.appendChild(hiddenInput);

    return hiddenInput;
}

function getInput (form) {
    return form.querySelector('[name="' + Const.UPLOAD_SANDBOX_HIDDEN_INPUT_NAME + '"]') || createInput(form);
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

        Array.prototype.slice.call(fileList).forEach(function (file) {
            files.push({
                name: file.name,
                type: file.type,
                data: file.base64
            });
        });

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
