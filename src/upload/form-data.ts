import { FileInputInfo } from '../typings/upload';
import INTERNAL_ATTRS from '../processing/dom/internal-attributes';
import FormDataEntry from './form-data-entry';
import * as bufferUtils from '../utils/buffer';
import { parse as parseJSON } from '../utils/json';

const BOUNDARY_RE = /;\s*boundary=([^;]*)/i;

enum ParserState { //eslint-disable-line no-shadow
    inPreamble,
    inHeaders,
    inBody,
    inEpilogue
}

export default class FormData {
    boundary: Buffer | null = null;
    private _boundaryEnd: Buffer | null = null;
    private _epilogue: Buffer[] = [];
    private _entries: FormDataEntry[] = [];
    private _preamble: Buffer[] = [];

    private _removeEntry (name: string): void {
        this._entries = this._entries.filter(entry => entry.name !== name);
    }

    private _injectFileInfo (fileInfo: FileInputInfo): void {
        const entries     = this._getEntriesByName(fileInfo.name);
        let previousEntry = null as FormDataEntry | null;

        for (let idx = 0; idx < fileInfo.files.length; idx++) {
            let entry = entries[idx];

            if (!entry) {
                entry = previousEntry ? previousEntry.cloneWithRawHeaders() : new FormDataEntry();

                this._entries.push(entry);
            }

            previousEntry = entry;
            entry.addFileInfo(fileInfo, idx);
        }
    }

    private _isBoundary (line: Buffer): boolean {
        return (this.boundary as Buffer).equals(line);
    }

    private _isBoundaryEnd (line: Buffer): boolean {
        return (this._boundaryEnd as Buffer).equals(line);
    }

    private _getEntriesByName (name: string): FormDataEntry[] {
        return this._entries.reduce((found: FormDataEntry[], entry: FormDataEntry) => {
            if (entry.name === name)
                found.push(entry);

            return found;
        }, []);
    }

    expandUploads (): void {
        const uploadsEntry = this._getEntriesByName(INTERNAL_ATTRS.uploadInfoHiddenInputName)[0];

        if (uploadsEntry) {
            const body  = Buffer.concat(uploadsEntry.body).toString();
            const files = parseJSON(body) as FileInputInfo[];

            this._removeEntry(INTERNAL_ATTRS.uploadInfoHiddenInputName);
            files.forEach(fileInfo => this._injectFileInfo(fileInfo));
        }
    }

    parseContentTypeHeader (header: string|void): void {
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
        let currentEntry = null as FormDataEntry | null;

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
                    currentEntry?.setRawHeader(line.toString()); // eslint-disable-line no-unused-expressions
                else
                    state = ParserState.inBody;
            }

            else if (state === ParserState.inEpilogue)
                bufferUtils.appendLine(this._epilogue, line);

            else if (state === ParserState.inBody && currentEntry)
                bufferUtils.appendLine(currentEntry.body, line);
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
