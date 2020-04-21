import { FileInputInfo } from '../typings/upload';
import * as bufferUtils from '../utils/buffer';
import BUILTIN_HEADERS from '../request-pipeline/builtin-header-names';

const INPUT_NAME_RE = /;\s*name="([^"]*)"/i;
const FILE_NAME_RE  = /;\s*filename="([^"]*)"/i;
const HEADER_RE     = /^(.+?):\s*(.*)$/;

export default class FormDataEntry {
    private _headers: { [name: string]: string } = {};
    body: Buffer[] = [];
    name: string = '';
    fileName: string = '';

    private _parseContentDisposition (contentDisposition: string) {
        const inputNameMatch = contentDisposition.match(INPUT_NAME_RE);
        const fileNameMatch  = contentDisposition.match(FILE_NAME_RE);

        this.name     = inputNameMatch && inputNameMatch[1] || '';
        this.fileName = fileNameMatch && fileNameMatch[1] || '';
    }

    private _setContentDisposition (name: string, fileName: string) {
        this.name     = name;
        this.fileName = fileName;

        this._headers[BUILTIN_HEADERS.contentDisposition] = `form-data; name="${name}"; filename="${fileName}"`;
    }

    // API
    addFileInfo (fileInfo: FileInputInfo, idx: number) {
        const file = fileInfo.files[idx];

        this._setContentDisposition(fileInfo.name, file.name);

        this.body                                  = [Buffer.from(file.data, 'base64')];
        this._headers[BUILTIN_HEADERS.contentType] = file.type;
    }

    setHeader (header: string, newValue?: string) {
        const headerMatch = header.match(HEADER_RE);
        const name        = headerMatch && headerMatch[1].toLowerCase() || '';
        const value       = newValue || headerMatch && headerMatch[2] || '';

        this._headers[name] = value;

        if (name === BUILTIN_HEADERS.contentDisposition)
            this._parseContentDisposition(value);
    }

    toBuffer (): Buffer {
        const chunks: Buffer[] = [];

        for (const name of Object.keys(this._headers)) {
            const value = this._headers[name];

            chunks.push(Buffer.from(`${name}: ${value}`));
            chunks.push(bufferUtils.CRLF);
        }

        chunks.push(bufferUtils.CRLF);

        return Buffer.concat(chunks.concat(this.body));
    }
}
