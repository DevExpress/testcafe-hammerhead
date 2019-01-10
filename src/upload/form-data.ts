import INTERNAL_ATTRS from '../processing/dom/internal-attributes';
import FormDataEntry from './form-data-entry';
import * as bufferUtils from '../utils/buffer';

const BOUNDARY_RE: RegExp = /;\s*boundary=([^;]*)/i;

const PARSER_STATE = {
    inPreamble: 'IN_PREAMBLE',
    inHeaders:  'IN_HEADERS',
    inBody:     'IN_BODY',
    inEpilogue: 'IN_EPILOGUE'
};

export default class FormData {
    boundary: any;
    boundaryEnd: any;
    epilogue: any;
    entries: Array<any>;
    preamble: Array<any>;

    constructor () {
        this.boundary    = null;
        this.boundaryEnd = null;
        this.epilogue    = [];
        this.entries     = [];
        this.preamble    = [];
    }

    _removeEntry (name) {
        this.entries = this.entries.filter(entry => entry.name !== name);
    }

    _injectFileInfo (fileInfo) {
        const entries = this.getEntriesByName(fileInfo.name);

        for (let idx = 0; idx < fileInfo.files.length; idx++) {
            let entry = entries[idx];

            if (!entry) {
                entry = new FormDataEntry();

                this.entries.push(entry);
            }

            entry.addFileInfo(fileInfo, idx);
        }
    }

    _isBoundary (line) {
        return this.boundary.equals(line);
    }

    _isBoundaryEnd (line) {
        return this.boundaryEnd.equals(line);
    }

    getEntriesByName (name) {
        return this.entries.reduce((found, entry) => {
            if (entry.name === name)
                found.push(entry);

            return found;
        }, []);
    }

    expandUploads () {
        const uploadsEntry = this.getEntriesByName(INTERNAL_ATTRS.uploadInfoHiddenInputName)[0];

        if (uploadsEntry) {
            const body  = Buffer.concat(uploadsEntry.body).toString();
            const files = JSON.parse(body);

            this._removeEntry(INTERNAL_ATTRS.uploadInfoHiddenInputName);
            files.forEach(fileInfo => this._injectFileInfo(fileInfo));
        }
    }

    parseContentTypeHeader (header) {
        header = String(header);

        if (header.includes('multipart/form-data')) {
            const boundaryMatch = header.match(BOUNDARY_RE);
            const token         = boundaryMatch && boundaryMatch[1];

            if (token) {
                this.boundary    = Buffer.from('--' + token);
                this.boundaryEnd = Buffer.from('--' + token + '--');
            }
        }
    }

    parseBody (body) {
        let state        = PARSER_STATE.inPreamble;
        const lines      = bufferUtils.createLineIterator(body);
        let currentEntry = null;

        for (const line of lines) {
            if (this._isBoundary(line)) {
                if (currentEntry)
                    this.entries.push(currentEntry);

                state        = PARSER_STATE.inHeaders;
                currentEntry = new FormDataEntry();
            }

            else if (this._isBoundaryEnd(line)) {
                if (currentEntry)
                    this.entries.push(currentEntry);

                state = PARSER_STATE.inEpilogue;
            }

            else if (state === PARSER_STATE.inPreamble)
                bufferUtils.appendLine(this.preamble, line);

            else if (state === PARSER_STATE.inHeaders) {
                if (line.length)
                    currentEntry.setHeader(line.toString());

                else
                    state = PARSER_STATE.inBody;
            }

            else if (state === PARSER_STATE.inEpilogue)
                bufferUtils.appendLine(this.epilogue, line);

            else if (state === PARSER_STATE.inBody)
                bufferUtils.appendLine(currentEntry.body, line);
        }
    }

    toBuffer () {
        let chunks = this.preamble;

        if (chunks.length)
            chunks.push(bufferUtils.CRLF);

        this.entries.forEach(entry => {
            chunks.push(
                this.boundary,
                bufferUtils.CRLF,
                entry.toBuffer(),
                bufferUtils.CRLF
            );
        });

        chunks.push(
            this.boundaryEnd,
            bufferUtils.CRLF
        );

        chunks = chunks.concat(this.epilogue);

        return Buffer.concat(chunks);
    }
}
