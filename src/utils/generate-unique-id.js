import nanoIdGenerate from 'nanoid/generate';
import nanoIdAlphabet from 'nanoid/url';

const UNIQUE_ID_ALPHABET = nanoIdAlphabet.replace(/-|~/g, '');

export default function () {
    return nanoIdGenerate(UNIQUE_ID_ALPHABET, 9);
}
