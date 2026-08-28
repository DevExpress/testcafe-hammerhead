import { customAlphabet } from 'nanoid';

const UNIQUE_ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DEFAULT_ID_LENGTH  = 9;

export default function (length?: number): string {
    const generator = customAlphabet(UNIQUE_ID_ALPHABET, DEFAULT_ID_LENGTH);

    return generator(length || DEFAULT_ID_LENGTH);
}
