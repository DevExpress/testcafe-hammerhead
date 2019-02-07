import FormData from './form-data';

export function inject (contentTypeHeader, body): Buffer {
    const formData = new FormData();

    formData.parseContentTypeHeader(contentTypeHeader);

    if (!formData.boundary)
        return null;

    formData.parseBody(body);
    formData.expandUploads();

    return formData.toBuffer();
}
