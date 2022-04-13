import { Readable } from 'stream';

const LF          = 0x0A;
const CR          = 0x0D;
const CRLF_LENGTH = 2;

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
        },
    };
}

export function appendLine (lines: any[], line: any): void {
    if (lines.length)
        lines.push(CRLF);

    lines.push(line);
}

export function startsWith (buffer: Buffer, searchBuffer: Buffer): boolean {
    if (buffer.length < searchBuffer.length)
        return false;

    for (let i = 0; i < searchBuffer.length; i++) {
        if (buffer[i] !== searchBuffer[i])
            return false;
    }

    return true;
}

export function toReadableStream (buffer: Buffer): Readable {
    const stream = new Readable();

    stream.push(buffer);
    stream.push(null);

    return stream;
}
