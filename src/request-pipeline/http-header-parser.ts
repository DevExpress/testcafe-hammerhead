import { MESSAGE, getText } from '../messages';
import { Dictionary } from '../typings/common';

const HEADER_LINE_SEPARATOR             = '\r\n';
const HEADER_BODY_SEPARATOR             = ':';
const HEADER_BODY_INVALID_CHARACTERS    = [ '\n', '\r' ];
const HEADER_NAME_VALID_CHAR_CODE_RANGE = { min: 33, max: 126 };
const HEADER_INVALID_CHAR_LOCATIONS     = { name: 'name', body: 'body' };

interface InvalidCharactersRecord extends Partial<Dictionary<string>> {
    name: string;
    body?: string;
    index: string;
}

export function getFormattedInvalidCharacters (rawHeaders: string): string {
    let invalidCharList = [] as InvalidCharactersRecord[];

    for (const header of rawHeaders.split(HEADER_LINE_SEPARATOR)) {
        const name = header.slice(0, header.indexOf(HEADER_BODY_SEPARATOR));
        const body = header.slice(header.indexOf(HEADER_BODY_SEPARATOR) + 1);

        invalidCharList = invalidCharList.concat(getInvalidCharacters(name, body));
    }

    return formatInvalidCharacters(invalidCharList);
}

function headerNameCharIsInvalid (char: string): boolean {
    return char.charCodeAt(0) < HEADER_NAME_VALID_CHAR_CODE_RANGE.min || char.charCodeAt(0) > HEADER_NAME_VALID_CHAR_CODE_RANGE.max;
}

function headerBodyCharIsInvalid (char: string): boolean {
    return HEADER_BODY_INVALID_CHARACTERS.includes(char);
}

function getInvalidCharacters (name: string, body: string): InvalidCharactersRecord[] {
    const invalidCharList = [] as InvalidCharactersRecord[];

    for (let i = 0; i < name.length; i++) {
        if (headerNameCharIsInvalid(name[i])) {
            invalidCharList.push({
                name:     name,
                location: HEADER_INVALID_CHAR_LOCATIONS.name,
                charCode: '' + name[i].charCodeAt(0),
                index:    i.toString(),
            });
        }
    }

    for (let i = 0; i < body.length; i++) {
        if (headerBodyCharIsInvalid(body[i])) {
            invalidCharList.push({
                name:     name,
                location: HEADER_INVALID_CHAR_LOCATIONS.body,
                charCode: '' + body[i].charCodeAt(0),
                index:    i.toString(),
            });
        }
    }

    return invalidCharList;
}

function formatInvalidCharacters (invalidCharactersList: InvalidCharactersRecord[]): string {
    return invalidCharactersList
        .map(invalidCharacter => getText(MESSAGE.invalidHeaderCharacter, invalidCharacter))
        .join('\n');
}
