import BaseResource from './base-resource';
import FileSystemResource from './filesystem-resource';
import AsarResource from './asar-resource';

function isFileNotExists (errCode: string): boolean {
    return errCode === 'ENOENT' ||
        errCode === 'ENOTDIR'; // NOTE: found it (ENOTDIR) on travis server tests (GH-2043 PR)
}

export default async function createResource (path: string): Promise<BaseResource> {
    let resource: BaseResource = new FileSystemResource(path);

    await resource.init();

    if (resource.error && isFileNotExists(resource.error.code)) {
        const asarResource = new AsarResource(path);

        await asarResource.init();

        if (asarResource.isArchiveFound)
            resource = asarResource;
    }

    return resource;
}
