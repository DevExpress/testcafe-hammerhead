export default function (stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];

        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', error => reject(error));
    });
}
