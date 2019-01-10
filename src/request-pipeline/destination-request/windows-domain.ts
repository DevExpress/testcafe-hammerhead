import { exec } from '../../utils/promisified-functions';

let cached = null;

async function queryOSForCredential (cmd) {
    try {
        const credential:any = await exec(cmd);

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
