import nanoIdGenerate from 'nanoid/generate';
import nanoIdAlphabet from 'nanoid/url';

const UNIQUE_ID_ALPHABET: string = nanoIdAlphabet.replace(/-|~/g, '');

export default function (): string {
    return nanoIdGenerate(UNIQUE_ID_ALPHABET, 9);
}
