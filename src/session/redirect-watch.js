const CLIENT_REQUEST_TIMEOUT = 5000;

export default class RedirectWatch {
    constructor () {
        this.clientRequests      = [];
        this.clientConfirmations = {};
    }

    _sendClientResponse (referer, target) {
        this._getClientRequest(referer, target).callback();
        this._removeClientRequest(referer, target);
    }

    async _waitClientConfirmation (window) {
        return new Promise(resolve => {
            this.clientConfirmations[window] = resolve;
            setTimeout(() => this.clientConfirmation(window), 100);
        });
    }

    clientConfirmation (window) {
        if (this.clientConfirmations[window]) {
            this.clientConfirmations[window]();
            delete this.clientConfirmations[window];
        }
    }

    isExpectedResponse (referer, target) {
        return !!this._getClientRequest(referer, target);
    }

    _findClientRequest (condition) {
        for (var i = 0; i < this.clientRequests.length; i++) {
            if (condition(this.clientRequests[i], i))
                return i;
        }

        return -1;
    }

    _getClientRequest (referer, target) {
        var reqIndex = -1;

        if (target)
            reqIndex = this._findClientRequest(req => req.window === target);
        else
            reqIndex = this._findClientRequest(req => req.referer === referer);

        return this.clientRequests[reqIndex];
    }

    _addClientRequest (referer, window, conformationNeeded, handler) {
        var reqIndex = -1;
        var req      = {
            referer,
            window,
            conformationNeeded,

            callback: aborted => {
                this._removeClientRequest(referer, window);
                handler(aborted);
            }
        };

        if (window)
            reqIndex = this._findClientRequest(request => request.window === window);
        else
            reqIndex = this._findClientRequest(request => request.referer === referer);

        if (reqIndex !== -1)
            this.clientRequests[reqIndex].callback(true);

        this.clientRequests.push(req);
    }

    _removeClientRequest (referer, window) {
        var reqIndex = -1;

        if (window)
            reqIndex = this._findClientRequest(req => req.window === window);

        if (reqIndex === -1)
            reqIndex = this._findClientRequest(req => req.referer === referer);

        if (reqIndex !== -1)
            this.clientRequests.splice(reqIndex, 1);
    }

    async clientRequest (referer, window, conformationNeeded) {
        return new Promise(resolve => {
            var id = setTimeout(() => {
                this._removeClientRequest(referer, window);
                clearTimeout(id);
                resolve('tryAgain');
            }, CLIENT_REQUEST_TIMEOUT);

            this._addClientRequest(referer, window, conformationNeeded, aborted => {
                clearTimeout(id);
                resolve(aborted ? 'tryAgain' : 'detected');
            });
        });
    }

    async serverResponse (referer, target, clientReady) {
        var conformationNeeded = this._getClientRequest(referer, target).conformationNeeded;

        this._sendClientResponse(referer, target);

        if (conformationNeeded) {
            await this._waitClientConfirmation(target);
            clientReady();
        }
        else
            setTimeout(clientReady, 50);
    }
}
