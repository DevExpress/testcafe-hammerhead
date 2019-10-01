import { FileInputInfo } from '../typings/upload';
import INTERNAL_ATTRS from '../processing/dom/internal-attributes';
import FormDataEntry from './form-data-entry';
import * as bufferUtils from '../utils/buffer';

const BOUNDARY_RE: RegExp = /;\s*boundary=([^;]*)/i;

/*eslint-disable no-unused-vars*/
enum ParserState {
    inPreamble,
    inHeaders,
    inBody,
    inEpilogue
}
/*eslint-enable no-unused-vars*/

export default class FormData {
    boundary: Buffer | null = null;
    private _boundaryEnd: Buffer | null = null;
    private _epilogue: Array<Buffer> = [];
    private _entries: Array<FormDataEntry> = [];
    private _preamble: Array<Buffer> = [];

    private _removeEntry (name: string) {
        this._entries = this._entries.filter(entry => entry.name !== name);
    }

    private _injectFileInfo (fileInfo: FileInputInfo) {
        const entries = this._getEntriesByName(fileInfo.name);

        for (let idx = 0; idx < fileInfo.files.length; idx++) {
            let entry = entries[idx];

            if (!entry) {
                entry = new FormDataEntry();

                this._entries.push(entry);
            }

            entry.addFileInfo(fileInfo, idx);
        }
    }

    private _isBoundary (line: Buffer): boolean {
        return (<Buffer> this.boundary).equals(line); // eslint-disable-line no-extra-parens
    }

    private _isBoundaryEnd (line: Buffer): boolean {
        return (<Buffer> this._boundaryEnd).equals(line); // eslint-disable-line no-extra-parens
    }

    private _getEntriesByName (name: string): Array<FormDataEntry> {
        return this._entries.reduce((found: Array<FormDataEntry>, entry: FormDataEntry) => {
            if (entry.name === name)
                found.push(entry);

            return found;
        }, []);
    }

    expandUploads (): void {
        const uploadsEntry = this._getEntriesByName(INTERNAL_ATTRS.uploadInfoHiddenInputName)[0];

        if (uploadsEntry) {
            const body  = Buffer.concat(uploadsEntry.body).toString();
            const files = <Array<FileInputInfo>>JSON.parse(body);

            this._removeEntry(INTERNAL_ATTRS.uploadInfoHiddenInputName);
            files.forEach(fileInfo => this._injectFileInfo(fileInfo));
        }
    }

    parseContentTypeHeader (header: string|void) {
        header = String(header);

        if (header.includes('multipart/form-data')) {
            const boundaryMatch = header.match(BOUNDARY_RE);
            const token         = boundaryMatch && boundaryMatch[1];

            if (token) {
                this.boundary     = Buffer.from('--' + token);
                this._boundaryEnd = Buffer.from('--' + token + '--');
            }
        }
    }

    parseBody (body: Buffer): void {
        let state        = ParserState.inPreamble;
        const lines      = bufferUtils.createLineIterator(body);
        let currentEntry = null;

        for (const line of lines) {
            if (this._isBoundary(line)) {
                if (currentEntry)
                    this._entries.push(currentEntry);

                state        = ParserState.inHeaders;
                currentEntry = new FormDataEntry();
            }

            else if (this._isBoundaryEnd(line)) {
                if (currentEntry)
                    this._entries.push(currentEntry);

                state = ParserState.inEpilogue;
            }

            else if (state === ParserState.inPreamble)
                bufferUtils.appendLine(this._preamble, line);

            else if (state === ParserState.inHeaders) {
                if (line.length)
                    (<FormDataEntry>currentEntry).setHeader(line.toString()); // eslint-disable-line no-extra-parens
                else
                    state = ParserState.inBody;
            }

            else if (state === ParserState.inEpilogue)
                bufferUtils.appendLine(this._epilogue, line);

            else if (state === ParserState.inBody)
                bufferUtils.appendLine((<FormDataEntry>currentEntry).body, line); // eslint-disable-line no-extra-parens
        }
    }

    toBuffer (): Buffer | null {
        if (!this._boundaryEnd || !this.boundary)
            return null;

        let chunks = this._preamble;

        if (chunks.length)
            chunks.push(bufferUtils.CRLF);

        for (const entry of this._entries) {
            chunks.push(
                this.boundary,
                bufferUtils.CRLF,
                entry.toBuffer(),
                bufferUtils.CRLF
            );
        }

        chunks.push(
            this._boundaryEnd,
            bufferUtils.CRLF
        );

        chunks = chunks.concat(this._epilogue);

        return Buffer.concat(chunks);
    }
}
