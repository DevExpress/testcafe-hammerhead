import childProcess from 'child_process';
import promisify from 'es6-promisify';

var exec   = promisify(childProcess.exec);
var cached = null;

async function queryOSForCredential (cmd) {
    try {
        var credential = await exec(cmd);

        return credential.replace(/\s/g, '');
    }
    catch (err) {
        return '';
    }
}

export async function assign (credentials) {
    if (!cached) {
        cached = {
            domain:      await queryOSForCredential('echo %userdomain%'),
            workstation: await queryOSForCredential('hostname')
        };
    }

    credentials.domain      = credentials.domain || cached.domain;
    credentials.workstation = credentials.workstation || cached.workstation;
}
