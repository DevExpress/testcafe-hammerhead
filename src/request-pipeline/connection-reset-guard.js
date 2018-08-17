import domain from 'domain';
import os from 'os';

const connectionResetDomain = domain.create();

connectionResetDomain.on('error', err => {
    // NOTE: The nodejs throw the EPIPE error instead of the ECONNRESET error
    // when the connection is broken in some cases on MacOS
    if (err.code === 'ECONNRESET' || os.type() === 'Darwin' && err.code === 'EPIPE')
        return;

    connectionResetDomain.removeAllListeners('error');
    throw err;
});

export default function (fn) {
    connectionResetDomain.run(fn);
}
