import domain from 'domain';
import os from 'os-family';

const connectionResetDomain = domain.create();

export function isConnectionResetError (err: NodeJS.ErrnoException) {
    return err.code === 'ECONNRESET' || !os.win && err.code === 'EPIPE' || os.win && err.code === 'ECONNABORTED';
}

connectionResetDomain.on('error', (err: NodeJS.ErrnoException) => {
    // NOTE: The nodejs throw the EPIPE error instead of the ECONNRESET error
    // when the connection is broken in some cases on MacOS and Linux
    // https://github.com/nodejs/node/blob/8b4af64f50c5e41ce0155716f294c24ccdecad03/test/parallel/test-http-destroyed-socket-write2.js
    if (isConnectionResetError(err))
        return;

    connectionResetDomain.removeAllListeners('error');
    throw err;
});

export function connectionResetGuard (fn: (...args: any[]) => unknown) {
    connectionResetDomain.run(fn);
}
