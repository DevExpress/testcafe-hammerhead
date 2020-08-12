import INTERNAL_ATTRS from '../../../processing/dom/internal-attributes';
import nativeMethods from '../native-methods';
import * as JSON from 'json-hammerhead';
import ShadowUI from '../shadow-ui';

function createInput (form: HTMLFormElement) {
    const hiddenInput = nativeMethods.createElement.call(document, 'input');

    hiddenInput.type  = 'hidden';
    hiddenInput.name  = INTERNAL_ATTRS.uploadInfoHiddenInputName;

    ShadowUI.markElementAsShadow(hiddenInput);

    nativeMethods.inputValueSetter.call(hiddenInput, '[]');
    nativeMethods.appendChild.call(form, hiddenInput);

    ShadowUI.markFormAsShadow(form);

    return hiddenInput;
}

function getInput (form: HTMLFormElement) {
    const inputSelector = '[name="' + INTERNAL_ATTRS.uploadInfoHiddenInputName + '"]';

    return nativeMethods.elementQuerySelector.call(form, inputSelector) || createInput(form);
}

function indexOf (info, input) {
    for (let index = 0; index < info.length; index++) {
        if (info[index].id === input.id || info[index].name === input.name)
            return index;
    }

    return -1;
}

export function addInputInfo (input, fileList, value) {
    const formInfo = getFormInfo(input);

    if (formInfo) {
        const files = [];

        fileList = nativeMethods.arraySlice.call(fileList);

        for (let i = 0, len = fileList.length; i < len; i++) {
            const file = fileList[i];

            files.push({
                name: file.name,
                type: file.type,
                data: file.base64
            });
        }

        const inputInfoIndex = indexOf(formInfo, input);
        const inputInfo      = {
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
    return input.form ? JSON.parse(nativeMethods.inputValueGetter.call(getInput(input.form))) : null;
}

export function setFormInfo (input, info) {
    if (input.form) {
        const hiddenInput = getInput(input.form);

        nativeMethods.inputValueSetter.call(hiddenInput, JSON.stringify(info));
    }
}

export function removeInputInfo (input) {
    const uploadInfo = getFormInfo(input);

    if (uploadInfo) {
        const inputInfoIndex = indexOf(uploadInfo, input);

        if (inputInfoIndex !== -1) {
            uploadInfo.splice(inputInfoIndex, 1);
            setFormInfo(input, uploadInfo);

            return true;
        }
    }

    return false;
}
