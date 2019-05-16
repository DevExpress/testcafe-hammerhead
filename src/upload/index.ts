import FormData from './form-data';

export function inject (contentTypeHeader: string|void, body: Buffer): Buffer | null {
    const formData = new FormData();

    formData.parseContentTypeHeader(contentTypeHeader);

    if (!formData.boundary)
        return null;

    formData.parseBody(body);
    formData.expandUploads();

    return formData.toBuffer();
}
