// @ts-ignore
import nanoIdGenerate from 'nanoid/generate';
// @ts-ignore
import nanoIdAlphabet from 'nanoid/url';

const UNIQUE_ID_ALPHABET: string = nanoIdAlphabet.replace(/-|~/g, '');

const DEFAULT_ID_LENGTH = 9;

export default function (length?: number): string {
    return nanoIdGenerate(UNIQUE_ID_ALPHABET, length || DEFAULT_ID_LENGTH);
}
