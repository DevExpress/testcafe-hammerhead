import domain from 'domain';
import os from 'os';

const connectionResetDomain = domain.create();

connectionResetDomain.on('error', err => {
    if (err.code === 'ECONNRESET' || os.type() === 'Darwin' && err.code === 'EPIPE')
        return;

    connectionResetDomain.removeAllListeners('error');
    throw err;
});

export default function (fn) {
    connectionResetDomain.run(fn);
}
