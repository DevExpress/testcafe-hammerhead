import * as bufferUtils from '../utils/buffer';

// Const
const INPUT_NAME_RE = /;\s*name="([^"]*)"/i;
const FILE_NAME_RE  = /;\s*filename="([^"]*)"/i;
const HEADER_RE     = /^(.+?):\s*(.*)$/;


// FormDataEntry
export default class FormDataEntry {
    constructor () {
        this.body     = [];
        this.headers  = {};
        this.name     = null;
        this.fileName = null;
    }

    _parseContentDisposition (contentDisposition) {
        const inputNameMatch = contentDisposition.match(INPUT_NAME_RE);
        const fileNameMatch  = contentDisposition.match(FILE_NAME_RE);

        this.name     = inputNameMatch && inputNameMatch[1];
        this.fileName = fileNameMatch && fileNameMatch[1];
    }

    _setContentDisposition (name, fileName) {
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

    setHeader (header, newValue) {
        const headerMatch = header.match(HEADER_RE);
        const name        = headerMatch[1];
        const value       = newValue || headerMatch [2];

        this.headers[name] = value;

        if (name === 'Content-Disposition')
            this._parseContentDisposition(value);
    }

    toBuffer () {
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
