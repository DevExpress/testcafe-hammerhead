import domain from 'domain';
import os from 'os';

const connectionResetDomain = domain.create();

connectionResetDomain.on('error', err => {
    // NOTE: The nodejs throw the EPIPE error instead of the ECONNRESET error
    // when the connection is broken in some cases on MacOS and Linux
    const isMacOrLinux = os.type() === 'Darwin' || os.type() === 'Linux';

    if (err.code === 'ECONNRESET' || isMacOrLinux && err.code === 'EPIPE')
        return;

    connectionResetDomain.removeAllListeners('error');
    throw err;
});

export default function (fn) {
    connectionResetDomain.run(fn);
}
