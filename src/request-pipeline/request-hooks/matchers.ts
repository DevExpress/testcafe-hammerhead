import { isRegExp } from 'lodash';
import { ensureOriginTrailingSlash } from '../../utils/url';

export function matchUrl (optionValue: string | RegExp | void, checkedValue: string) {
    if (optionValue === void 0)
        return true;

    if (typeof optionValue === 'string') {
        optionValue = ensureOriginTrailingSlash(optionValue);

        return optionValue === checkedValue;
    }

    else if (isRegExp(optionValue))
        return optionValue.test(checkedValue);

    return false;
}

export function matchMethod (optionValue: string | void, checkedValue: string) {
    if (optionValue === void 0)
        return true;

    if (typeof optionValue === 'string')
        return optionValue === checkedValue;

    return false;
}

export function matchIsAjax (optionValue: boolean | void, checkedValue: boolean) {
    if (optionValue === void 0)
        return true;

    if (typeof optionValue === 'boolean')
        return optionValue === checkedValue;

    return false;
}
