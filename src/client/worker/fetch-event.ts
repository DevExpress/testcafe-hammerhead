import nativeMethods from '../sandbox/native-methods';
import { stopPropagation } from '../utils/event';
import { parseProxyUrl } from '../utils/url';
import { ParsedUrl } from '../../typings/url';
import { SET_SERVICE_WORKER_SETTINGS } from './set-settings-command';
import INSTRUCTION from '../../processing/script/instruction';

/*eslint-disable*/

const swFetchCheckSettings = {
    protocol: '',
    host:     '',
    scope:    ''
};

function isCorrectScope (parsedUrl: ParsedUrl): boolean {
    return parsedUrl.protocol === swFetchCheckSettings.protocol &&
        parsedUrl.host === swFetchCheckSettings.host &&
        parsedUrl.partAfterHost.startsWith(swFetchCheckSettings.scope);
}

export default function overrideFetchEvent () {
    let waitSettingsPromise = new Promise<void>((resolve, reject) => {
        nativeMethods.windowAddEventListener.call(self, 'message', function onMessage (e: any/*ExtendableMessageEvent*/) {
            const data = e.data;

            if (data.cmd !== SET_SERVICE_WORKER_SETTINGS)
                return;

            const swScopeHeaderExists = self[INSTRUCTION.swScopeHeaderValue] !== void 0;
            const currentScope        = swScopeHeaderExists ? self[INSTRUCTION.swScopeHeaderValue] : data.currentScope;

            let scope = data.optsScope;

            if (!scope)
                scope = currentScope;
            else if (!scope.startsWith(currentScope)) {
                // @ts-ignore
                self.registration.unregister();

                const errorMessage = `The path of the provided scope ('${data.optsScope}') is not under the max ` +
                                     `scope allowed (${swScopeHeaderExists ? 'set by Service-Worker-Allowed: ' : ''}'` +
                                     `${currentScope}'). Adjust the scope, move the Service Worker script, ` +
                                     'or use the Service-Worker-Allowed HTTP header to allow the scope.';

                e.ports[0].postMessage({ error: errorMessage });
                reject(new Error(errorMessage));

                return;
            }

            e.ports[0].postMessage({});

            swFetchCheckSettings.protocol = data.protocol;
            swFetchCheckSettings.host     = data.host;
            swFetchCheckSettings.scope    = scope;

            nativeMethods.windowRemoveEventListener.call(self, 'message', onMessage);
            stopPropagation(e);

            waitSettingsPromise = null;
            resolve();
        });
    });

    self.addEventListener('install', (e: any/*InstallEvent*/) => e.waitUntil(waitSettingsPromise));

    nativeMethods.windowAddEventListener.call(self, 'fetch', (e: any/*FetchEvent*/) => {
        const request           = e.request as Request;
        const proxyUrl          = nativeMethods.requestUrlGetter.call(request);
        const parsedProxyUrl    = parseProxyUrl(proxyUrl);
        const isInternalRequest = !parsedProxyUrl;

        if (!isInternalRequest) {
            // @ts-ignore Chrome has a non-standard the "iframe" destination
            const isPage = request.destination === 'document' || request.destination === 'iframe';

            if (isPage) {
                if (isCorrectScope(parsedProxyUrl.destResourceInfo))
                    return;
            }
            else {
                const proxyReferrer       = nativeMethods.requestReferrerGetter.call(request);
                const parsedProxyReferrer = parseProxyUrl(proxyReferrer);

                if (parsedProxyReferrer && isCorrectScope(parsedProxyReferrer.destResourceInfo))
                    return;
            }
        }

        // NOTE: This request should not have gotten into this service worker
        e.respondWith(nativeMethods.fetch.call(self, request));
        stopPropagation(e);
    });
}
