import trim from '../../utils/string-trim';
import nativeMethods from '../../../src/client/sandbox/native-methods';

const COOKIE_PAIR_REGEX        = /^((?:=)?([^=;]*)\s*=\s*)?([^\n\r\0]*)/;
const TRAILING_SEMICOLON_REGEX = /;+$/;

export function parse (str) {
    str = trim(str);

    const trailingSemicolonCheck = TRAILING_SEMICOLON_REGEX.exec(str);

    if (trailingSemicolonCheck)
        str = str.slice(0, trailingSemicolonCheck.index);

    const firstSemicolonIdx     = str.indexOf(';');
    const keyValueString        = firstSemicolonIdx > -1 ? str.substr(0, firstSemicolonIdx) : str;
    const keyValueParsingResult = COOKIE_PAIR_REGEX.exec(keyValueString);

    if (!keyValueParsingResult)
        return null;

    const parsedCookie = {
        key:   keyValueParsingResult[1] ? trim(keyValueParsingResult[2]) : '',
        value: trim(keyValueParsingResult[3])
    };

    if (firstSemicolonIdx === -1)
        return parsedCookie;

    const attributesString = trim(str.slice(firstSemicolonIdx).replace(/^\s*;\s*/, ''));

    if (attributesString.length === 0)
        return parsedCookie;

    const attrValStrings = attributesString.split(/\s*;\s*/);

    while (attrValStrings.length) {
        const attrValueStr = attrValStrings.shift();
        const separatorIdx = attrValueStr.indexOf('=');
        let key            = null;
        let value          = null;

        if (separatorIdx === -1)
            key = attrValueStr;
        else {
            key   = attrValueStr.substr(0, separatorIdx);
            value = trim(attrValueStr.substr(separatorIdx + 1));
        }

        key = trim(key.toLowerCase());

        switch (key) {
            case 'expires':
            case 'max-age':
            case 'path':
                parsedCookie[key] = value;
                break;

            case 'secure':
            case 'httponly':
                parsedCookie[key] = true;
                break;

            case 'domain':
                // NOTE: Remove leading '.'.
                parsedCookie.domain = trim(value.replace(/^\./, ''));
                break;

            default:
                break;
        }
    }

    return parsedCookie;
}

export function format (parsedCookie) {
    let cookieStr = parsedCookie.value || '';

    if (parsedCookie.key !== '')
        cookieStr = parsedCookie.key + '=' + cookieStr;

    cookieStr += ';';

    for (const attrName in parsedCookie) {
        if (nativeMethods.objectHasOwnProperty.call(parsedCookie, attrName)) {
            if (attrName !== 'key' && attrName !== 'value') {
                cookieStr += attrName;

                // NOTE: Skip attributes without value and boolean attributes (e.g. Secure).
                if (parsedCookie[attrName] !== void 0 && parsedCookie[attrName] !== true)
                    cookieStr += '=' + parsedCookie[attrName];

                cookieStr += ';';
            }
        }
    }

    return cookieStr;
}

export function get (document, name) {
    const cookies = document.cookie.split(';');

    for (let i = 0; i < cookies.length; i++) {
        const cookie = trim(cookies[i]);

        if (cookie.indexOf(name + '=') === 0 || cookie === name)
            return cookie;
    }

    return null;
}

export function del (document, parsedCookie) {
    parsedCookie.expires = 'Thu, 01 Jan 1970 00:00:01 GMT';
    parsedCookie.value   = '';

    document.cookie = format(parsedCookie);
}
