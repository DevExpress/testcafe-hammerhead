import * as Stream from 'stream';

export default function (stream: Stream): any {
    return new Promise((resolve, reject) => {
        const chunks = [];

        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', error => reject(error));
    });
}
