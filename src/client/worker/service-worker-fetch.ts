//import { overrideDescriptor } from '../utils/property-overriding';
import nativeMethods from '../sandbox/native-methods';
import { stopPropagation } from '../utils/event';
import { parseProxyUrl } from '../utils/url';
import { ParsedProxyUrl } from '../../typings/url';
//import SET_SW_SETTINGS from './set-sw-settings-command';

// eslint-disable-next-line no-restricted-properties
const hammerheadOrigin = self.location.origin;

function isInternalRequest (proxyUrl: string, parsedProxyUrl: ParsedProxyUrl | null): boolean {
    return proxyUrl.startsWith(hammerheadOrigin) && parsedProxyUrl === null;
}

function checkScope (url: string): boolean {
    return url === '';
}

export default function overrideFetchEvent () {
    nativeMethods.windowAddEventListener.call(self, 'fetch', (e: Event) => {
        // @ts-ignore
        const request        = e.request as Request;
        const proxyUrl       = nativeMethods.requestUrlGetter.call(request);
        const parsedProxyUrl = parseProxyUrl(proxyUrl);

        if (!isInternalRequest(proxyUrl, parsedProxyUrl) && !checkScope(proxyUrl))
            return;

        // @ts-ignore
        e.respondWith(nativeMethods.fetch.call(self, request));
        stopPropagation(e);
    });

    // nativeMethods.windowAddEventListener.call(self, 'message', function onMessage (e: MessageEvent) { //ExtendableMessageEvent
    //     const data = nativeMethods.messageEventDataGetter.call(e);
    //
    //     if (data.cmd !== SET_SW_SETTINGS)
    //         return;
    //
    //     // TODO: Apply settings
    //
    //     nativeMethods.windowRemoveEventListener.call(self, 'message', onMessage);
    //     stopPropagation(e);
    // });
}
