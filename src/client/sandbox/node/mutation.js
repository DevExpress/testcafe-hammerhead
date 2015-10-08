import EventEmitter from '../../utils/event-emitter';

export default class NodeMutation extends EventEmitter {
    constructor () {
        super();

        this.BEFORE_DOCUMENT_CLEANED_EVENT = 'hammerhead|event|before-document-cleaned';
        this.DOCUMENT_CLEANED_EVENT        = 'hammerhead|event|document-cleaned';
        this.DOCUMENT_CLOSED_EVENT         = 'hammerhead|event|document-closed';
        this.BODY_CONTENT_CHANGED_EVENT    = 'hammerhead|event|body-content-changed';
        this.BODY_CREATED_EVENT            = 'hammerhead|event|body-created';
        this.IFRAME_ADDED_TO_DOM_EVENT     = 'hammerhead|event|iframe-added-to-dom';
    }

    onIframeAddedToDOM (e) {
        this.emit(this.IFRAME_ADDED_TO_DOM_EVENT, e);
    }

    onBeforeDocumentCleaned (e) {
        this.emit(this.BEFORE_DOCUMENT_CLEANED_EVENT, e);
    }

    onDocumentCleaned (e) {
        this.emit(this.DOCUMENT_CLEANED_EVENT, e);
    }

    onDocumentClosed (e) {
        this.emit(this.DOCUMENT_CLOSED_EVENT, e);
    }

    onBodyContentChanged (e) {
        this.emit(this.BODY_CONTENT_CHANGED_EVENT, e);
    }

    onBodyCreated (e) {
        this.emit(this.BODY_CREATED_EVENT, e);
    }
}
