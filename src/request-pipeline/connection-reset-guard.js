import domain from 'domain';
import osFamily from 'os-family';

const connectionResetDomain = domain.create();

connectionResetDomain.on('error', err => {
    // NOTE: The nodejs throw the EPIPE error instead of the ECONNRESET error
    // when the connection is broken in some cases on MacOS and Linux
    const isMacOrLinux = osFamily.mac || osFamily.linux;

    if (err.code === 'ECONNRESET' || isMacOrLinux && err.code === 'EPIPE')
        return;

    connectionResetDomain.removeAllListeners('error');
    throw err;
});

export default function (fn) {
    connectionResetDomain.run(fn);
}
