import domain from 'domain';

var connectionResetDomain = domain.create();

connectionResetDomain.on('error', err => {
    if (err.code !== 'ECONNRESET') {
        connectionResetDomain.removeAllListeners('error');
        throw new Error(err);
    }
});

export default function (fn) {
    connectionResetDomain.run(fn);
}
