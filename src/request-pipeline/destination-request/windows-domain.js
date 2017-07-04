import childProcess from 'child_process';
import promisify from '../../utils/promisify';

const exec = promisify(childProcess.exec);
let cached = null;

async function queryOSForCredential (cmd) {
    try {
        const credential = await exec(cmd);

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
