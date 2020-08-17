import domain from 'domain';
// @ts-ignore
import os from 'os-family';

const connectionResetDomain = domain.create();

connectionResetDomain.on('error', err => {
    // NOTE: The nodejs throw the EPIPE error instead of the ECONNRESET error
    // when the connection is broken in some cases on MacOS and Linux
    // https://github.com/nodejs/node/blob/8b4af64f50c5e41ce0155716f294c24ccdecad03/test/parallel/test-http-destroyed-socket-write2.js
    if (err.code === 'ECONNRESET' || !os.win && err.code === 'EPIPE' || os.win && err.code === 'ECONNABORTED')
        return;

    connectionResetDomain.removeAllListeners('error');
    throw err;
});

export default function (fn: (...args: any[]) => unknown) {
    connectionResetDomain.run(fn);
}
