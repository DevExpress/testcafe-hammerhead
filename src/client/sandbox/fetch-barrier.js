import EventEmitter from '../utils/event-emitter';
import nativeMethods from './native-methods';
import Promise from 'pinkie';

const REQUESTS_COLLECTION_DELAY              = 300;
const ADDITIONAL_REQUESTS_COLLECTION_DELAY   = 100;
const PAGE_INITIAL_REQUESTS_COLLECTION_DELAY = 50;
const FETCH_REQUESTS_FINISHED_EVENT          = 'fetch-requests-finished';

export default class FetchBarrier extends EventEmitter {
    // NOTE: after moving to testcafe the 'fetchSandbox' parameter will be deleted
    constructor (fetchSandbox) {
        super();

        this.BARRIER_TIMEOUT = 3000;

        this.passed                    = false;
        this.collectingRequestPromises = true;
        this.requestPromises           = [];
        this.watchdog                  = null;

        this.fetchSandbox = fetchSandbox;

        this._init();
    }

    _init () {
        var onFetchRequestSend = e => this._onFetchRequestSend(e);

        this.fetchSandbox.on(this.fetchSandbox.FETCH_REQUEST_SEND_EVENT, onFetchRequestSend);

        this._unbindHandler = () => {
            this.fetchSandbox.off(this.fetchSandbox.FETCH_REQUEST_SEND_EVENT, onFetchRequestSend);
        };
    }

    // Copy from https://github.com/DevExpress/testcafe/blob/master/src/client/core/utils/delay.js
    // Will be removed after move to testcafe
    delay (ms) {
        return new Promise(resolve => nativeMethods.setTimeout.call(window, resolve, ms));
    }

    // Copy from https://github.com/churkin/testcafe/blob/master/src/client/core/utils/array.js
    removeItem (arr, item) {
        var index = arr.indexOf(item);

        if (index > -1)
            arr.splice(index, 1);
    }

    _onFetchRequestSend (requestPromise) {
        if (this.collectingRequestPromises) {
            this.requestPromises.push(requestPromise);

            var onFetchRequestCompleted = () => this._onFetchRequestCompleted(requestPromise);
            var onFetchRequestError     = () => this._onFetchRequestError(requestPromise);

            requestPromise.then(onFetchRequestCompleted);
            requestPromise.catch(onFetchRequestError);
        }

    }

    _onFetchRequestCompleted (requestPromise) {
        // NOTE: let the last real XHR handler finish its job and try to obtain
        // any additional requests if they were initiated by this handler
        this.delay(ADDITIONAL_REQUESTS_COLLECTION_DELAY)
            .then(() => this._onFetchRequestFinished(requestPromise));
    }

    _onFetchRequestError (requestPromise) {
        this._onFetchRequestFinished(requestPromise);
    }

    _onFetchRequestFinished (requestPromise) {
        if (this.requestPromises.indexOf(requestPromise) !== -1) {
            this.removeItem(this.requestPromises, requestPromise);

            if (!this.collectingRequestPromises && !this.requestPromises.length)
                this.emit(FETCH_REQUESTS_FINISHED_EVENT);
        }
    }

    wait (isPageLoad) {
        var sandbox = this;

        return new Promise(resolve => {
            sandbox.delay(isPageLoad ? PAGE_INITIAL_REQUESTS_COLLECTION_DELAY : REQUESTS_COLLECTION_DELAY)
                .then(() => {
                    sandbox.collectingRequestPromises = false;

                    var onRequestsFinished = () => {
                        if (sandbox.watchdog)
                            nativeMethods.clearTimeout.call(window, sandbox.watchdog);

                        sandbox._unbindHandler();
                        resolve();
                    };

                    if (sandbox.requestPromises.length) {
                        sandbox.watchdog = nativeMethods.setTimeout.call(window, onRequestsFinished, sandbox.BARRIER_TIMEOUT);
                        sandbox.on(FETCH_REQUESTS_FINISHED_EVENT, onRequestsFinished);
                    }
                    else
                        onRequestsFinished();
                });
        });
    }

}
