import { MESSAGE, getText } from '../messages';

const HEADER_LINE_SEPARATOR             = '\r\n';
const HEADER_BODY_SEPARATOR             = ':';
const HEADER_BODY_INVALID_CHARACTERS    = [ '\n', '\r' ];
const HEADER_NAME_VALID_CHAR_CODE_RANGE = { min: 33, max: 126 };
const HEADER_INVALID_CHAR_LOCATIONS     = { name: 'name', body: 'body' };

interface InvalidCharactersRecord {
    name:  string;
    body?: string;
    index: number;
}

export function getFormattedInvalidCharacters (rawHeaders: string): string {
    let invalidCharList = [];

    for (const header of rawHeaders.split(HEADER_LINE_SEPARATOR)) {
        const name = header.slice(0, header.indexOf(HEADER_BODY_SEPARATOR));
        const body = header.slice(header.indexOf(HEADER_BODY_SEPARATOR) + 1);

        invalidCharList = invalidCharList.concat(getInvalidCharacters(name, body));
    }

    return formatInvalidCharacters(invalidCharList);
}

function getInvalidCharacters (name: string, body: string): InvalidCharactersRecord[] {
    const invalidCharList = [];

    for (let i = 0; i < name.length; i++) {
        if (name[i].charCodeAt(0) < HEADER_NAME_VALID_CHAR_CODE_RANGE.min || name[i].charCodeAt(0) > HEADER_NAME_VALID_CHAR_CODE_RANGE.max) {
            invalidCharList.push({
                name: name,
                location: HEADER_INVALID_CHAR_LOCATIONS.name,
                charCode: name[i].charCodeAt(0),
                index: i
            });
        }
    }

    for (let i = 0; i < body.length; i++) {
        if (HEADER_BODY_INVALID_CHARACTERS.includes(body[i])) {
            invalidCharList.push({
                name: name,
                location: HEADER_INVALID_CHAR_LOCATIONS.body,
                charCode: body[i].charCodeAt(0),
                index: i
            });
        }
    }

    return invalidCharList;
}

function formatInvalidCharacters (invalidCharactersList: InvalidCharactersRecord[]): string {
    const formattedInvalidCharacters = [];

    for (const record of invalidCharactersList) {
        formattedInvalidCharacters.push(getText(MESSAGE.invalidHeaderCharacter, record));
    }

    return formattedInvalidCharacters.join('\n');
}
