import { FileInputInfo } from '../typings/upload';
import * as bufferUtils from '../utils/buffer';
import BUILTIN_HEADERS from '../request-pipeline/builtin-header-names';

const INPUT_NAME_RE = /;\s*name="([^"]*)"/i;
const FILE_NAME_RE  = /;\s*filename="([^"]*)"/i;
const HEADER_RE     = /^(.+?):\s*(.*)$/;

export default class FormDataEntry {
    private _headers: Map<string, { rawName: string; value: string }> = new Map();
    body: Buffer[] = [];
    name = '';
    fileName = '';

    private _parseContentDisposition (contentDisposition: string) {
        const inputNameMatch = contentDisposition.match(INPUT_NAME_RE);
        const fileNameMatch  = contentDisposition.match(FILE_NAME_RE);

        this.name     = inputNameMatch && inputNameMatch[1] || '';
        this.fileName = fileNameMatch && fileNameMatch[1] || '';
    }

    private _setHeader (name: string, value: string, rawHeader?: string) {
        if (!this._headers.has(name))
            this._headers.set(name, { rawName: typeof rawHeader === 'string' ? rawHeader : name, value });
        else {
            const header = this._headers.get(name);

            if (header)
                header.value = value;
        }
    }

    private _setContentDisposition (name: string, fileName: string) {
        this.name     = name;
        this.fileName = fileName;

        this._setHeader(BUILTIN_HEADERS.contentDisposition, `form-data; name="${name}"; filename="${fileName}"`);
    }

    // API
    addFileInfo (fileInfo: FileInputInfo, idx: number) {
        const file = fileInfo.files[idx];

        this._setContentDisposition(fileInfo.name, file.name);

        this.body = [Buffer.from(file.data, 'base64')];

        this._setHeader(BUILTIN_HEADERS.contentType, file.type);
    }

    setRawHeader (rawHeader: string) {
        const [, rawName = '', value = ''] = rawHeader.match(HEADER_RE) || [];
        const name                         = rawName.toLowerCase();

        this._headers.set(name, { rawName, value });

        if (name === BUILTIN_HEADERS.contentDisposition)
            this._parseContentDisposition(value);
    }

    toBuffer (): Buffer {
        const chunks: Buffer[] = [];

        for (const { rawName, value } of this._headers.values()) {
            chunks.push(Buffer.from(`${rawName}: ${value}`));
            chunks.push(bufferUtils.CRLF);
        }

        chunks.push(bufferUtils.CRLF);

        return Buffer.concat(chunks.concat(this.body));
    }

    cloneWithRawHeaders () {
        const entry = new FormDataEntry();

        for (const [name, { rawName }] of this._headers)
            entry._setHeader(name, '', rawName);

        return entry;
    }
}
