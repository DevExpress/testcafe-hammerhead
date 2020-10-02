//import { overrideDescriptor } from '../utils/property-overriding';
import nativeMethods from '../sandbox/native-methods';
import { stopPropagation } from '../utils/event';
import { parseProxyUrl } from '../utils/url';
import { ParsedUrl } from '../../typings/url';
import SET_SW_SETTINGS from './set-sw-settings-command';
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
    let waitSettingsPromise = new Promise((resolve, reject) => {
        nativeMethods.windowAddEventListener.call(self, 'message', function onMessage (e: MessageEvent) {
            const data = e.data;

            if (data.cmd !== SET_SW_SETTINGS)
                return;

            const curentScope = self[INSTRUCTION.swScopeHeaderValue] !== void 0
                ? self[INSTRUCTION.swScopeHeaderValue]
                : data.currentScope;

            let scope = data.optsScope;

            if (!scope)
                scope = curentScope;
            else if (!scope.startsWith(curentScope)) {
                // @ts-ignore
                self.registration.unregister();
                reject(new Error('Wrong scope!'));
            }

            swFetchCheckSettings.protocol = data.protocol;
            swFetchCheckSettings.host     = data.host;
            swFetchCheckSettings.scope    = scope;

            nativeMethods.windowRemoveEventListener.call(self, 'message', onMessage);
            stopPropagation(e);

            waitSettingsPromise = null;
            resolve();
        });
    });

    nativeMethods.windowAddEventListener.call(self, 'fetch', (e: Event) => {
        // @ts-ignore
        const request        = e.request as Request;
        const proxyUrl       = nativeMethods.requestUrlGetter.call(request);
        const parsedProxyUrl = parseProxyUrl(proxyUrl);

        // NOTE: It is internal request
        if (!parsedProxyUrl) {
            // @ts-ignore
            e.respondWith(nativeMethods.fetch.call(self, request));
            stopPropagation(e);

            return;
        }
        // NOTE: Settings is not initialized
        else if (waitSettingsPromise) {
            stopPropagation(e);

            // @ts-ignore
            waitSettingsPromise.then(() => {
                if (!isCorrectScope(parsedProxyUrl.destResourceInfo)) {
                    // @ts-ignore
                    e.respondWith(nativeMethods.fetch.call(self, request));
                }
                else
                    nativeMethods.dispatchEvent.call(self, e);
            });

            return;
        }
        // NOTE: This request should not have gotten into this service worker
        else if (!isCorrectScope(parsedProxyUrl.destResourceInfo)) {
            // @ts-ignore
            e.respondWith(nativeMethods.fetch.call(self, request));
            stopPropagation(e);

            return;
        }
    });
}
