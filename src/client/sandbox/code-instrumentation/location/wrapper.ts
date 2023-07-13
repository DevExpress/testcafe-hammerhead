import {
    get as getDestLocation,
    getParsed as getParsedDestLocation,
    sameOriginCheck,
} from '../../../utils/destination-location';
import {
    getProxyUrl,
    changeDestUrlPart,
    parseProxyUrl,
    parseResourceType,
    isChangedOnlyHash,
    getCrossDomainProxyPort,
} from '../../../utils/url';
import {
    getDomain,
    getResourceTypeString,
    ensureTrailingSlash,
    prepareUrl,
    SPECIAL_BLANK_PAGE,
} from '../../../../utils/url';
import * as domUtils from '../../../utils/dom';
import nativeMethods from '../../native-methods';
import urlResolver from '../../../utils/url-resolver';
import DomProcessor from '../../../../processing/dom';
import DOMStringListWrapper from './ancestor-origins-wrapper';
import IntegerIdGenerator from '../../../utils/integer-id-generator';
import { createOverriddenDescriptor, overrideStringRepresentation } from '../../../utils/overriding';
import MessageSandbox from '../../event/message';
import { isFunction } from '../../../utils/types';
import { ParsedProxyUrl, ResourceType } from '../../../../typings/url';


const GET_ORIGIN_CMD      = 'hammerhead|command|get-origin';
const ORIGIN_RECEIVED_CMD = 'hammerhead|command|origin-received';

function getLocationUrl (window: Window): string | undefined {
    try {
        return window.location.toString();
    }
    catch (e) {
        return void 0;
    }
}

class LocationInheritor {}

LocationInheritor.prototype = Location.prototype;

export default class LocationWrapper extends LocationInheritor {
    constructor (window: Window, messageSandbox: MessageSandbox, onChanged: Function) {
        super();

        const context = new LocationContext(window, messageSandbox, onChanged);

        const locationProps: any = {};

        // eslint-disable-next-line no-restricted-properties
        locationProps.href   = context.createOverriddenHrefDescriptor();
        // eslint-disable-next-line no-restricted-properties
        locationProps.search = context.createOverriddenSearchDescriptor();
        // eslint-disable-next-line no-restricted-properties
        locationProps.origin = context.createOverriddenOriginDescriptor();
        locationProps.hash   = context.createOverriddenHashDescriptor();

        if (window.location.ancestorOrigins)
            locationProps.ancestorOrigins = context.createOverriddenAncestorOriginsDescriptor(this);

        // eslint-disable-next-line no-restricted-properties
        locationProps.port     = context.createOverriddenPortDescriptor();
        // eslint-disable-next-line no-restricted-properties
        locationProps.host     = context.createOverriddenHostDescriptor();
        // eslint-disable-next-line no-restricted-properties
        locationProps.hostname = context.createOverriddenHostnameDescriptor();
        // eslint-disable-next-line no-restricted-properties
        locationProps.pathname = context.createOverriddenPathnameDescriptor();
        // eslint-disable-next-line no-restricted-properties
        locationProps.protocol = context.createOverriddenProtocolDescriptor();
        locationProps.assign   = context.createOverriddenAssignDescriptor();
        locationProps.replace  = context.createOverriddenReplaceDescriptor();
        locationProps.reload   = context.createOverriddenReloadDescriptor();
        locationProps.toString = context.createOverriddenToStringDescriptor();

        if (!context.isLocationPropsInProto && nativeMethods.objectHasOwnProperty.call(window.location, 'valueOf'))
            locationProps.valueOf = context.createOverriddenValueOfDescriptor();

        nativeMethods.objectDefineProperties(this, locationProps);

        // NOTE: We shouldn't break the client script if the browser add the new API. For example:
        // > From Chrome 80 to Chrome 85, the fragmentDirective property was defined on Location.prototype.
        context.overrideRestDescriptors(this, locationProps);
    }
}

class LocationContext {
    public isLocationPropsInProto: boolean;
    private window: Window;
    private messageSandbox: MessageSandbox;
    private onChanged: Function;
    private parsedLocation: ParsedProxyUrl | null;
    private locationResourceType: string;
    private parsedResourceType: ResourceType;
    private locationPropsOwner: Location;
    private resourceType: string | null;

    constructor (window: Window, messageSandbox: MessageSandbox, onChanged: Function) {
        this.window         = window;
        this.messageSandbox = messageSandbox;
        this.onChanged      = onChanged;

        this.parsedLocation         = parseProxyUrl(getLocationUrl(window) as string);
        this.locationResourceType   = this.parsedLocation ? this.parsedLocation.resourceType : '';
        this.parsedResourceType     = parseResourceType(this.locationResourceType);// @ts-ignore
        this.isLocationPropsInProto = nativeMethods.objectHasOwnProperty.call(window.Location.prototype, 'href');// @ts-ignore
        this.locationPropsOwner     = this.isLocationPropsInProto ? window.Location.prototype : window.location;

        this.parsedResourceType.isIframe = this.parsedResourceType.isIframe || domUtils.isIframeWindow(window);

        this.resourceType = getResourceTypeString({
            isIframe: this.parsedResourceType.isIframe,
            isForm:   this.parsedResourceType.isForm,
        });
    }

    public createOverriddenHrefDescriptor () {
        const context = this;

        return createOverriddenDescriptor(this.locationPropsOwner, 'href', {
            getter: context.createHrefGetter(context.window),
            setter: (href: string) => {
                const proxiedHref = context.getProxiedHref(href, context);

                // eslint-disable-next-line no-restricted-properties
                context.window.location.href = proxiedHref;

                context.onChanged(proxiedHref);

                return href;
            },
        });
    }

    public createOverriddenToStringDescriptor () {
        const context = this;

        return createOverriddenDescriptor(this.locationPropsOwner, 'toString', {
            value: this.createHrefGetter(context.window),
        });
    }

    private createHrefGetter (window: Window) {
        return function () {
            // eslint-disable-next-line no-restricted-properties
            if (domUtils.isIframeWindow(window) && window.location.href === SPECIAL_BLANK_PAGE)
                return SPECIAL_BLANK_PAGE;

            const locationUrl    = getDestLocation();
            const resolveElement = urlResolver.getResolverElement(window.document);

            nativeMethods.anchorHrefSetter.call(resolveElement, locationUrl);

            const href = nativeMethods.anchorHrefGetter.call(resolveElement);

            return ensureTrailingSlash(href, locationUrl);
        };
    }

    private getProxiedHref (href: any, locationWrapper: this) {
        const window = locationWrapper.window;

        if (typeof href !== 'string')
            href = String(href);

        href = prepareUrl(href);

        if (DomProcessor.isJsProtocol(href))
            return DomProcessor.processJsAttrValue(href, { isJsProtocol: true, isEventAttr: false });

        const locationUrl = getLocationUrl(window);

        let proxyPort = null;

        if (window !== window.parent) {
            const parentLocationUrl       = getLocationUrl(window.parent) as string;
            const parsedParentLocationUrl = parseProxyUrl(parentLocationUrl);

            if (parsedParentLocationUrl && parsedParentLocationUrl.proxy) {
            // eslint-disable-next-line no-restricted-properties
                const parentProxyPort = parsedParentLocationUrl.proxy.port;

                proxyPort = sameOriginCheck(parentLocationUrl, href)
                    ? parentProxyPort
                    : getCrossDomainProxyPort(parentProxyPort);
            }
        }

        const changedOnlyHash     = locationUrl && isChangedOnlyHash(locationUrl, href);
        const currentResourceType = changedOnlyHash ? locationWrapper.locationResourceType : locationWrapper.resourceType;

        return getProxyUrl(href, { resourceType: currentResourceType, proxyPort });
    }

    public createOverriddenSearchDescriptor () {
        const context = this;

        return createOverriddenDescriptor(this.locationPropsOwner, 'search', {
            // eslint-disable-next-line no-restricted-properties
            getter: () => context.window.location.search,
            setter: search => {
                const newLocation = changeDestUrlPart(context.window.location.toString(), nativeMethods.anchorSearchSetter, search, context.resourceType);

                // @ts-ignore
                context.window.location = newLocation;
                context.onChanged(newLocation);

                return search;
            },
        });
    }

    public createOverriddenOriginDescriptor () {
        return createOverriddenDescriptor(this.locationPropsOwner, 'origin', {
            getter: () => getDomain(getParsedDestLocation()),
            setter: origin => origin,
        });
    }

    public createOverriddenHashDescriptor () {
        const context = this;

        return createOverriddenDescriptor(this.locationPropsOwner, 'hash', {
            getter: () => context.window.location.hash,
            setter: hash => {
                context.window.location.hash = hash;

                return hash;
            },
        });
    }

    public createOverriddenAncestorOriginsDescriptor (locationWrapper) {
        const context     = this;
        const callbacks   = nativeMethods.objectCreate(null);
        const idGenerator = new IntegerIdGenerator();

        const getCrossDomainOrigin = (win, callback) => {
            const id = idGenerator.increment();

            callbacks[id] = callback;

            context.messageSandbox.sendServiceMsg({ id, cmd: GET_ORIGIN_CMD }, win);
        };

        if (context.messageSandbox) {
            context.messageSandbox.on(context.messageSandbox.SERVICE_MSG_RECEIVED_EVENT, ({ message, source }) => {
                if (message.cmd === GET_ORIGIN_CMD) {
                    // @ts-ignore
                    context.messageSandbox.sendServiceMsg({ id: message.id, cmd: ORIGIN_RECEIVED_CMD, origin: locationWrapper.origin }, source);// eslint-disable-line no-restricted-properties
                }
                else if (message.cmd === ORIGIN_RECEIVED_CMD) {
                    const callback = callbacks[message.id];

                    if (callback)
                        callback(message.origin); // eslint-disable-line no-restricted-properties
                }
            });
        }

        const ancestorOrigins = new DOMStringListWrapper(context.window, context.messageSandbox ? getCrossDomainOrigin : void 0);

        return createOverriddenDescriptor(context.locationPropsOwner, 'ancestorOrigins', {
            //@ts-ignore
            getter: () => ancestorOrigins,
        });
    }

    public createOverriddenPortDescriptor () {
        return this.createOverriddenLocationAccessorDescriptor('port', nativeMethods.anchorPortSetter);
    }

    public createOverriddenHostDescriptor () {
        return this.createOverriddenLocationAccessorDescriptor('host', nativeMethods.anchorHostSetter);
    }

    public createOverriddenHostnameDescriptor () {
        return this.createOverriddenLocationAccessorDescriptor('hostname', nativeMethods.anchorHostnameSetter);
    }

    public createOverriddenPathnameDescriptor () {
        return this.createOverriddenLocationAccessorDescriptor('pathname', nativeMethods.anchorPathnameSetter);
    }

    public createOverriddenProtocolDescriptor () {
        return this.createOverriddenLocationAccessorDescriptor('protocol', nativeMethods.anchorProtocolSetter);
    }

    private createOverriddenLocationAccessorDescriptor (property, nativePropSetter) {
        const context = this;

        return createOverriddenDescriptor(this.locationPropsOwner, property, {
            getter: () => {
                const frameElement       = domUtils.getFrameElement(context.window);
                const inIframeWithoutSrc = frameElement && domUtils.isIframeWithoutSrc(frameElement);
                const parsedDestLocation = inIframeWithoutSrc ? context.window.location : getParsedDestLocation();

                return parsedDestLocation[property];
            },
            setter: value => {
                const newLocation = changeDestUrlPart(context.window.location.toString(), nativePropSetter, value, context.resourceType);

                // @ts-ignore
                context.window.location = newLocation;
                context.onChanged(newLocation);

                return value;
            },
        });
    }

    public createOverriddenAssignDescriptor () {
        return this.createOverriddenLocationDataDescriptor('assign');
    }

    public createOverriddenReplaceDescriptor () {
        return this.createOverriddenLocationDataDescriptor('replace');
    }

    private createOverriddenLocationDataDescriptor (property) {
        const context = this;

        return createOverriddenDescriptor(this.locationPropsOwner, property, {
            value: url => {
                const proxiedHref = context.getProxiedHref(url, context);
                const result      = context.window.location[property](proxiedHref);

                context.onChanged(proxiedHref);

                return result;
            },
        });
    }

    public createOverriddenReloadDescriptor () {
        const context = this;

        return createOverriddenDescriptor(this.locationPropsOwner, 'reload', {
            value: () => {
                const result = context.window.location.reload();

                context.onChanged(context.window.location.toString());

                return result;
            },
        });
    }

    public createOverriddenValueOfDescriptor () {
        //@ts-ignore
        return createOverriddenDescriptor(this.locationPropsOwner, 'valueOf', {
            value: () => this,
        });
    }

    public overrideRestDescriptors (locationWrapper, locationProps) {
        const protoKeys = nativeMethods.objectKeys(Location.prototype);

        for (const protoKey of protoKeys) {
            if (protoKey in locationProps)
                continue;

            const protoKeyDescriptor = nativeMethods.objectGetOwnPropertyDescriptor(Location.prototype, protoKey);

            this.overrideRestDescriptor(locationWrapper, protoKeyDescriptor, 'get');
            this.overrideRestDescriptor(locationWrapper, protoKeyDescriptor, 'set');
            this.overrideRestDescriptor(locationWrapper, protoKeyDescriptor, 'value');

            nativeMethods.objectDefineProperty(locationWrapper, protoKey, protoKeyDescriptor);
            // NOTE: We hide errors with a new browser API and we should know about it.
            nativeMethods.consoleMeths.log(`testcafe-hammerhead: unwrapped Location.prototype.${protoKey} descriptor!`);
        }
    }

    public overrideRestDescriptor (locationWrapper, descriptor, key: string) {
        if (!isFunction(descriptor[key]))
            return;

        const context      = this;
        const nativeMethod = descriptor[key];

        descriptor[key] = function () {
            const ctx = this === locationWrapper ? context.window.location : this;

            return nativeMethod.apply(ctx, arguments);
        };
    }
}

overrideStringRepresentation(LocationWrapper, Location);
