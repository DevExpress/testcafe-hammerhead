import { exec } from '../../utils/promisified-functions';
/*eslint-disable no-unused-vars*/
import { WindowCredentials } from '../../typings/session';
/*eslint-enable no-unused-vars*/

let cached: WindowCredentials = {};

async function queryOSForCredential (cmd: string): Promise<string> {
    try {
        const credential: string = await exec(cmd);

        return credential.replace(/\s/g, '');
    }
    catch (err) {
        return '';
    }
}

export async function assign (credentials: WindowCredentials) {
    if (!cached) {
        cached = {
            domain:      await queryOSForCredential('echo %userdomain%'),
            workstation: await queryOSForCredential('hostname')
        };
    }

    credentials.domain      = credentials.domain || cached.domain;
    credentials.workstation = credentials.workstation || cached.workstation;
}
