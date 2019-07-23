/*eslint-disable no-unused-vars*/
import BaseResource from './base-resource';
/*eslint-enable no-unused-vars*/
import FileSystemResource from './filesystem-resource';
import AsarResource from './asar-resource';

export default async function createResource (path: string) : Promise<BaseResource> {
    let resource: BaseResource = new FileSystemResource(path);

    await resource.init();

    if (resource.error &&
        (resource.error.code === 'ENOENT' || resource.error.code === 'ENOTDIR')) {
        const asarResource = new AsarResource(path);

        await asarResource.init();

        if (asarResource.isArchiveFound)
            resource = asarResource;
    }

    return resource;
}
