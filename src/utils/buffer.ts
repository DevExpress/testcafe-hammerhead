import { Readable } from 'stream';

const LF: number          = 0x0A;
const CR: number          = 0x0D;
const CRLF_LENGTH: number = 2;

export const CRLF: Buffer = Buffer.from([CR, LF]);

export function createLineIterator (buffer: Buffer) {
    return {
        [Symbol.iterator]: function* () {
            const lastIdx = buffer.length - 1;
            let start     = 0;

            for (let i = 0; i < buffer.length; i++) {
                if (i === lastIdx)
                    yield buffer.slice(start);

                else if (buffer[i] === CR && buffer[i + 1] === LF) {
                    yield buffer.slice(start, i);
                    start = i + CRLF_LENGTH;
                }
            }
        }
    };
}

export function appendLine (lines: Array<any>, line: any) {
    if (lines.length)
        lines.push(CRLF);

    lines.push(line);
}

export function toReadableStream (buffer) {
    const stream = new Readable();

    stream.push(buffer);
    stream.push(null);

    return stream;
}
