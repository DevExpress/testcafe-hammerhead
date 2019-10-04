import { FileInputInfo } from '../typings/upload';
import * as bufferUtils from '../utils/buffer';

const INPUT_NAME_RE: RegExp = /;\s*name="([^"]*)"/i;
const FILE_NAME_RE: RegExp  = /;\s*filename="([^"]*)"/i;
const HEADER_RE: RegExp     = /^(.+?):\s*(.*)$/;

export default class FormDataEntry {
    private _headers: { [name: string]: string } = {};
    body: Array<Buffer> = [];
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

        this._headers['Content-Disposition'] = `form-data; name="${name}"; filename="${fileName}"`;
    }

    // API
    addFileInfo (fileInfo: FileInputInfo, idx: number) {
        const file = fileInfo.files[idx];

        this._setContentDisposition(fileInfo.name, file.name);

        this.body                     = [Buffer.from(file.data, 'base64')];
        this._headers['Content-Type'] = file.type;
    }

    setHeader (header: string, newValue?: string) {
        const headerMatch = header.match(HEADER_RE);
        const name        = headerMatch && headerMatch[1] || '';
        const value       = newValue || headerMatch && headerMatch[2] || '';

        this._headers[name] = value;

        if (name === 'Content-Disposition')
            this._parseContentDisposition(value);
    }

    toBuffer (): Buffer {
        const chunks: Array<Buffer> = [];

        for (const name of Object.keys(this._headers)) {
            const value = this._headers[name];

            chunks.push(Buffer.from(`${name}: ${value}`));
            chunks.push(bufferUtils.CRLF);
        }

        chunks.push(bufferUtils.CRLF);

        return Buffer.concat(chunks.concat(this.body));
    }
}
