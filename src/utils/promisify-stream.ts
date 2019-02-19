/*eslint-disable no-unused-vars*/
import stream from 'stream';
/*eslint-enable no-unused-vars*/

export default function (s: stream.Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks = [];

        s.on('data', chunk => chunks.push(chunk));
        s.on('end', () => resolve(Buffer.concat(chunks)));
        s.on('error', error => reject(error));
    });
}
