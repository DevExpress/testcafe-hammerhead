import * as bufferUtils from '../utils/buffer';

const INPUT_NAME_RE: RegExp = /;\s*name="([^"]*)"/i;
const FILE_NAME_RE: RegExp  = /;\s*filename="([^"]*)"/i;
const HEADER_RE: RegExp     = /^(.+?):\s*(.*)$/;

export default class FormDataEntry {
    private body: Array<any> = [];
    private headers: any = {};
    name: any = null;
    fileName: any = null;

    _parseContentDisposition (contentDisposition: string) {
        const inputNameMatch = contentDisposition.match(INPUT_NAME_RE);
        const fileNameMatch  = contentDisposition.match(FILE_NAME_RE);

        this.name     = inputNameMatch && inputNameMatch[1];
        this.fileName = fileNameMatch && fileNameMatch[1];
    }

    _setContentDisposition (name: string, fileName: string) {
        this.name     = name;
        this.fileName = fileName;

        this.headers['Content-Disposition'] = `form-data; name="${name}"; filename="${fileName}"`;
    }

    // API
    addFileInfo (fileInfo, idx) {
        const file = fileInfo.files[idx];

        this._setContentDisposition(fileInfo.name, file.name);

        this.body                    = [Buffer.from(file.data, 'base64')];
        this.headers['Content-Type'] = file.type;
    }

    setHeader (header: string, newValue) {
        const headerMatch = header.match(HEADER_RE);
        const name        = headerMatch[1];
        const value       = newValue || headerMatch [2];

        this.headers[name] = value;

        if (name === 'Content-Disposition')
            this._parseContentDisposition(value);
    }

    toBuffer (): Buffer {
        let chunks = [];

        Object.keys(this.headers).forEach(name => {
            const value = this.headers[name];

            chunks.push(Buffer.from(`${name}: ${value}`));
            chunks.push(bufferUtils.CRLF);
        });

        chunks.push(bufferUtils.CRLF);
        chunks     = chunks.concat(this.body);

        return Buffer.concat(chunks);
    }
}
