import domain from 'domain';
import os from 'os-family';

const connectionResetDomain = domain.create();

connectionResetDomain.on('error', err => {
    // NOTE: The nodejs throw the EPIPE error instead of the ECONNRESET error
    // when the connection is broken in some cases on MacOS and Linux
    if (err.code === 'ECONNRESET' || !os.win && err.code === 'EPIPE')
        return;

    connectionResetDomain.removeAllListeners('error');
    throw err;
});

export default function (fn) {
    connectionResetDomain.run(fn);
}
