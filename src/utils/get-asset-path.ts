import { basename } from 'path';
import getClientScriptSuffix from './get-client-script-suffix';

export default function (originPath: string, developmentMode: boolean): string {
    if (!developmentMode)
        return originPath;

    const filename       = basename(originPath);
    const otherPathPart  = originPath.replace(filename, '');
    const filenameParts  = filename.split('.');
    const resultFilename = `${filenameParts[0]}${getClientScriptSuffix(developmentMode)}.${filenameParts[1]}`;

    return otherPathPart + resultFilename;
}
