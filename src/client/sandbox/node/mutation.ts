import EventEmitter from '../../utils/event-emitter';

export default class NodeMutation extends EventEmitter {
    BEFORE_DOCUMENT_CLEANED_EVENT: string = 'hammerhead|event|before-document-cleaned';
    DOCUMENT_CLEANED_EVENT: string = 'hammerhead|event|document-cleaned';
    DOCUMENT_CLOSED_EVENT: string = 'hammerhead|event|document-closed';
    BODY_CONTENT_CHANGED_EVENT: string = 'hammerhead|event|body-content-changed';
    BODY_CREATED_EVENT: string = 'hammerhead|event|body-created';
    IFRAME_ADDED_TO_DOM_EVENT: string = 'hammerhead|event|iframe-added-to-dom';

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
