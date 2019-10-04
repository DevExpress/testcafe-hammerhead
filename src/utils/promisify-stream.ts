import stream from 'stream';

export default function (s: stream.Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Array<any> = [];

        s.on('data', chunk => chunks.push(chunk));
        s.on('end', () => resolve(Buffer.concat(chunks)));
        s.on('error', error => reject(error));
    });
}
