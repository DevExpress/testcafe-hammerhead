import { exec } from '../../utils/promisified-functions';
import { WindowCredentials } from '../../typings/session';

let cached: WindowCredentials | null = null;

async function queryOSForCredential (cmd: string): Promise<string> {
    try {
        const { stdout } = await exec(cmd);

        return stdout.replace(/\s/g, '');
    }
    catch (err) {
        return '';
    }
}

export async function assign (credentials: WindowCredentials): Promise<void> {
    if (!cached) {
        cached = {
            domain:      await queryOSForCredential('echo %userdomain%'),
            workstation: await queryOSForCredential('hostname'),
        };
    }

    credentials.domain      = credentials.domain || cached.domain;
    credentials.workstation = credentials.workstation || cached.workstation;
}
