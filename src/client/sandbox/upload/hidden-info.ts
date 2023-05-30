import INTERNAL_ATTRS from '../../../processing/dom/internal-attributes';
import { parse as parseJSON, stringify as stringifyJSON } from '../../../utils/json';
import nativeMethods from '../native-methods';
import ShadowUI from '../shadow-ui';


const INPUT_SELECTOR = `[name="${INTERNAL_ATTRS.uploadInfoHiddenInputName}"]`;

function createInput (form: HTMLFormElement) {
    const hiddenInput = nativeMethods.createElement.call(document, 'input') as HTMLInputElement;

    hiddenInput.type  = 'hidden';
    hiddenInput.name  = INTERNAL_ATTRS.uploadInfoHiddenInputName;

    ShadowUI.markElementAsShadow(hiddenInput);

    nativeMethods.inputValueSetter.call(hiddenInput, '[]');
    nativeMethods.appendChild.call(form, hiddenInput);

    ShadowUI.markFormAsShadow(form);

    return hiddenInput;
}

function getInput (form: HTMLFormElement) {
    return nativeMethods.elementQuerySelector.call(form, INPUT_SELECTOR) || createInput(form);
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
                data: file.base64,
            });
        }

        const inputInfoIndex = indexOf(formInfo, input);
        const inputInfo      = {
            id:    input.id,
            name:  input.name,
            files: files,
            value: value,
        };

        if (inputInfoIndex === -1)
            formInfo.push(inputInfo);
        else
            formInfo[inputInfoIndex] = inputInfo;

        setFormInfo(input, formInfo);
    }
}

export function getFormInfo (input) {
    return input.form ? parseJSON(nativeMethods.inputValueGetter.call(getInput(input.form))) : null;
}

export function setFormInfo (input, info) {
    if (input.form) {
        const hiddenInput = getInput(input.form);

        nativeMethods.inputValueSetter.call(hiddenInput, stringifyJSON(info));
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

export function moveInputToFormBottom (form: HTMLFormElement) {
    const inputElement  = nativeMethods.elementQuerySelector.call(form, INPUT_SELECTOR);

    if (inputElement)
        nativeMethods.appendChild.call(form, inputElement);
}
