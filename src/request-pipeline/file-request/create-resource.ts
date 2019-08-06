/*eslint-disable no-unused-vars*/
import BaseResource from './base-resource';
/*eslint-enable no-unused-vars*/
import FileSystemResource from './filesystem-resource';
import AsarResource from './asar-resource';
import path from 'path';

function isFileNotExists (errCode: string): boolean {
    return errCode === 'ENOENT' ||
        errCode === 'ENOTDIR'; // NOTE: found it (ENOTDIR) on travis server tests (GH-2043 PR)
}

export default async function createResource (resourcePath: string) : Promise<BaseResource> {
    let resource: BaseResource = new FileSystemResource(resourcePath);

    await resource.init();

    if (resource.error && isFileNotExists(resource.error.code)) {
        // NOTE: use a normalize path in the case of asar resource (GH-2101 PR)
        const normalizeResourcePath = path.normalize(resourcePath);
        const asarResource          = new AsarResource(normalizeResourcePath);

        await asarResource.init();

        if (asarResource.isArchiveFound)
            resource = asarResource;
    }

    return resource;
}
