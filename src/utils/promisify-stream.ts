import { Readable } from 'stream';
import { ClientHttp2Stream } from 'http2';
import { noop } from 'lodash';

const SESSION_PING_TIMEOUT = 2_000;

export default function (s: Readable, contentLength?: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        let currentLength  = 0;
        const chunks       = [] as Buffer[];
        const finalLength  = typeof contentLength === 'string' ? parseInt(contentLength, 10) : null;
        const http2session = finalLength === null && 'session' in s &&
                             (s as ClientHttp2Stream).session || null;
        let isResolved     = false;
        let timeout: NodeJS.Timeout;

        s.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
            currentLength += chunk.length;

            if (currentLength === finalLength) {
                isResolved = true;
                resolve(Buffer.concat(chunks));
            }

            if (http2session) {
                clearTimeout(timeout);
                timeout = setTimeout(() => http2session.ping(noop), SESSION_PING_TIMEOUT);
            }
        });
        s.once('end', () => {
            clearTimeout(timeout);

            if (!isResolved)
                resolve(Buffer.concat(chunks));
        });
        s.once('error', error => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}
