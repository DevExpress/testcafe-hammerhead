import FormData from './form-data';
import url from 'url';
import { fetchBody, respondWithJSON } from '../utils/http';

// Utils
function getFileInfo (contentTypeHeader, body, inputName, fileName) {
    const formData = new FormData();

    formData.parseContentTypeHeader(contentTypeHeader);
    formData.parseBody(body);


    const entry = formData.getEntriesByName(inputName)[0];
    const data  = Buffer.concat(entry.body);

    fileName = fileName.substr(fileName.lastIndexOf('\\') + 1);

    return {
        data: data.toString('base64'),
        info: {
            type: entry.headers['Content-Type'],
            name: fileName,
            size: data.length
        }
    };
}


// API
export function inject (contentTypeHeader, body) {
    const formData = new FormData();

    formData.parseContentTypeHeader(contentTypeHeader);

    if (!formData.boundary)
        return null;

    formData.parseBody(body);
    formData.expandUploads();

    return formData.toBuffer();
}

export async function ie9FileReaderShim (req, res) {
    const body              = await fetchBody(req);
    const parsedUrl         = url.parse(req.url, true);
    const contentTypeHeader = req.headers['content-type'];
    const inputName         = parsedUrl.query['input-name'];
    const filename          = parsedUrl.query['filename'];
    const info              = getFileInfo(contentTypeHeader, body, inputName, filename);

    // NOTE: We should skip a content type, because IE9 can't handle content with the "application/json" content type
    // trying to download it as a file.
    respondWithJSON(res, info, true);
}

