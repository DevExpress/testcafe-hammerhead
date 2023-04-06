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
import { isIE11 } from '../../../utils/browser';
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
    private window: Window;
    private messageSandbox: MessageSandbox;
    private onChanged: Function;
    private locationResourceType: string;
    private locationPropsOwner: Location;
    private locationProps: any;
    private resourceType: string | null;

    constructor (window: Window, messageSandbox: MessageSandbox, onChanged: Function) {
        super();

        const parsedLocation         = parseProxyUrl(getLocationUrl(window) as string);
        const locationResourceType   = parsedLocation ? parsedLocation.resourceType : '';
        const parsedResourceType     = parseResourceType(locationResourceType);
        // @ts-ignore
        const isLocationPropsInProto = nativeMethods.objectHasOwnProperty.call(window.Location.prototype, 'href');
        // @ts-ignore
        const locationPropsOwner     = isLocationPropsInProto ? window.Location.prototype : window.location;
        const locationProps: any     = {};

        parsedResourceType.isIframe = parsedResourceType.isIframe || domUtils.isIframeWindow(window);

        const resourceType   = getResourceTypeString({
            isIframe: parsedResourceType.isIframe,
            isForm:   parsedResourceType.isForm,
        });

        this.window = window;
        this.messageSandbox = messageSandbox;
        this.onChanged = onChanged;
        this.locationResourceType = locationResourceType;
        this.locationPropsOwner = locationPropsOwner;
        this.locationProps = locationProps;
        this.resourceType = resourceType;

        // eslint-disable-next-line no-restricted-properties
        locationProps.href = this.createOverriddenHrefDescriptor();

        // eslint-disable-next-line no-restricted-properties
        locationProps.search = this.createOverriddenSearchDescriptor();

        // eslint-disable-next-line no-restricted-properties
        locationProps.origin = this.createOverriddenOriginDescriptor();
        locationProps.hash = this.createOverriddenHashDescriptor();

        if (window.location.ancestorOrigins)
            this.createOverriddenAncestorOriginsDescriptor();

        // eslint-disable-next-line no-restricted-properties
        locationProps.port = this.createOverriddenPortDescriptor();
        // eslint-disable-next-line no-restricted-properties
        locationProps.host = this.createOverriddenHostDescriptor();
        // eslint-disable-next-line no-restricted-properties
        locationProps.hostname = this.createOverriddenHostnameDescriptor();
        // eslint-disable-next-line no-restricted-properties
        locationProps.pathname = this.createOverriddenPathnameDescriptor();
        // eslint-disable-next-line no-restricted-properties
        locationProps.protocol = this.createOverriddenProtocolDescriptor();

        locationProps.assign = this.createOverriddenAssignDescriptor();

        locationProps.replace = this.createOverriddenReplaceDescriptor();

        locationProps.reload = this.createOverriddenReloadDescriptor();

        locationProps.toString = this.createOverriddenToStringDescriptor();

        if (!isLocationPropsInProto && nativeMethods.objectHasOwnProperty.call(window.location, 'valueOf'))
            locationProps.valueOf  = this.createOverriddenValueOfDescriptor();

        nativeMethods.objectDefineProperties(this, locationProps);

        // NOTE: We shouldn't break the client script if the browser add the new API. For example:
        // > From Chrome 80 to Chrome 85, the fragmentDirective property was defined on Location.prototype.
        if (isIE11)
            return;

        this.overrideRestDescriptors();
    }

    private createOverriddenHrefDescriptor () {
        const wrapper = this;

        return createOverriddenDescriptor(this.locationPropsOwner, 'href', {
            getter: wrapper.createHrefGetter(wrapper.window),
            setter: (href: string) => {
                const proxiedHref = wrapper.getProxiedHref(href, wrapper);

                // eslint-disable-next-line no-restricted-properties
                wrapper.window.location.href = proxiedHref;

                wrapper.onChanged(proxiedHref);

                return href;
            },
        });
    }

    private createOverriddenToStringDescriptor () {
        return createOverriddenDescriptor(this.locationPropsOwner, 'toString', {
            value: this.createHrefGetter(this.window),
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

    private createOverriddenSearchDescriptor () {
        const wrapper = this;

        return createOverriddenDescriptor(this.locationPropsOwner, 'search', {
            // eslint-disable-next-line no-restricted-properties
            getter: () => wrapper.window.location.search,
            setter: search => {
                const newLocation = changeDestUrlPart(wrapper.window.location.toString(), nativeMethods.anchorSearchSetter, search, wrapper.resourceType);

                // @ts-ignore
                wrapper.window.location = newLocation;
                wrapper.onChanged(newLocation);

                return search;
            },
        });
    }

    private createOverriddenOriginDescriptor () {
        return createOverriddenDescriptor(this.locationPropsOwner, 'origin', {
            getter: () => getDomain(getParsedDestLocation()),
            setter: origin => origin,
        });
    }

    private createOverriddenHashDescriptor () {
        const wrapper = this;

        return createOverriddenDescriptor(this.locationPropsOwner, 'hash', {
            getter: () => wrapper.window.location.hash,
            setter: hash => {
                wrapper.window.location.hash = hash;

                return hash;
            },
        });
    }

    private createOverriddenAncestorOriginsDescriptor () {
        const wrapper     = this;
        const callbacks   = nativeMethods.objectCreate(null);
        const idGenerator = new IntegerIdGenerator();

        const getCrossDomainOrigin = (win, callback) => {
            const id = idGenerator.increment();

            callbacks[id] = callback;

            wrapper.messageSandbox.sendServiceMsg({ id, cmd: GET_ORIGIN_CMD }, win);
        };

        if (this.messageSandbox) {
            this.messageSandbox.on(this.messageSandbox.SERVICE_MSG_RECEIVED_EVENT, ({ message, source }) => {
                if (message.cmd === GET_ORIGIN_CMD) {
                    // @ts-ignore
                    wrapper.messageSandbox.sendServiceMsg({ id: message.id, cmd: ORIGIN_RECEIVED_CMD, origin: this.origin }, source);// eslint-disable-line no-restricted-properties
                }
                else if (message.cmd === ORIGIN_RECEIVED_CMD) {
                    const callback = callbacks[message.id];

                    if (callback)
                        callback(message.origin); // eslint-disable-line no-restricted-properties
                }
            });
        }

        const ancestorOrigins = new DOMStringListWrapper(this.window, this.messageSandbox ? getCrossDomainOrigin : void 0);

        return createOverriddenDescriptor(this.locationPropsOwner, 'ancestorOrigins', {
            //@ts-ignore
            getter: () => ancestorOrigins,
        });
    }

    private createOverriddenPortDescriptor () {
        return this.createOverriddenLocationAccessorDescriptor('port', nativeMethods.anchorPortSetter);
    }

    private createOverriddenHostDescriptor () {
        return this.createOverriddenLocationAccessorDescriptor('host', nativeMethods.anchorHostSetter);
    }

    private createOverriddenHostnameDescriptor () {
        return this.createOverriddenLocationAccessorDescriptor('hostname', nativeMethods.anchorHostnameSetter);
    }

    private createOverriddenPathnameDescriptor () {
        return this.createOverriddenLocationAccessorDescriptor('pathname', nativeMethods.anchorPathnameSetter);
    }

    private createOverriddenProtocolDescriptor () {
        return this.createOverriddenLocationAccessorDescriptor('protocol', nativeMethods.anchorProtocolSetter);
    }

    private createOverriddenLocationAccessorDescriptor (property, nativePropSetter) {
        const wrapper = this;

        return createOverriddenDescriptor(this.locationPropsOwner, property, {
            getter: () => {
                const frameElement       = domUtils.getFrameElement(wrapper.window);
                const inIframeWithoutSrc = frameElement && domUtils.isIframeWithoutSrc(frameElement);
                const parsedDestLocation = inIframeWithoutSrc ? wrapper.window.location : getParsedDestLocation();

                return parsedDestLocation[property];
            },
            setter: value => {
                const newLocation = changeDestUrlPart(wrapper.window.location.toString(), nativePropSetter, value, wrapper.resourceType);

                // @ts-ignore
                wrapper.window.location = newLocation;
                wrapper.onChanged(newLocation);

                return value;
            },
        });
    }

    private createOverriddenAssignDescriptor () {
        return this.createOverriddenLocationDataDescriptor('assign');
    }

    private createOverriddenReplaceDescriptor () {
        return this.createOverriddenLocationDataDescriptor('replace');
    }

    private createOverriddenLocationDataDescriptor (property) {
        const wrapper = this;

        return createOverriddenDescriptor(this.locationPropsOwner, property, {
            value: url => {
                const proxiedHref = wrapper.getProxiedHref(url, wrapper);
                const result      = wrapper.window.location[property](proxiedHref);

                wrapper.onChanged(proxiedHref);

                return result;
            },
        });
    }

    private createOverriddenReloadDescriptor () {
        const wrapper = this;

        return createOverriddenDescriptor(this.locationPropsOwner, 'reload', {
            value: () => {
                const result = wrapper.window.location.reload();

                wrapper.onChanged(wrapper.window.location.toString());

                return result;
            },
        });
    }

    private createOverriddenValueOfDescriptor () {
        //@ts-ignore
        return createOverriddenDescriptor(this.locationPropsOwner, 'valueOf', {
            value: () => this,
        });
    }

    private overrideRestDescriptors () {
        const protoKeys = nativeMethods.objectKeys(Location.prototype);

        for (const protoKey of protoKeys) {
            if (protoKey in this.locationProps)
                continue;

            const protoKeyDescriptor = nativeMethods.objectGetOwnPropertyDescriptor(Location.prototype, protoKey);

            this.overrideRestDescriptor(protoKeyDescriptor, 'get');
            this.overrideRestDescriptor(protoKeyDescriptor, 'set');
            this.overrideRestDescriptor(protoKeyDescriptor, 'value');

            nativeMethods.objectDefineProperty(this, protoKey, protoKeyDescriptor);
            // NOTE: We hide errors with a new browser API and we should know about it.
            nativeMethods.consoleMeths.log(`testcafe-hammerhead: unwrapped Location.prototype.${protoKey} descriptor!`);
        }
    }

    private overrideRestDescriptor (descriptor, key: string) {
        if (!isFunction(descriptor[key]))
            return;

        const wrapper      = this;
        const nativeMethod = descriptor[key];

        descriptor[key] = function () {
            const ctx = this === wrapper ? wrapper.window.location : this;

            return nativeMethod.apply(ctx, arguments);
        };
    }
}

// NOTE: window.Location in IE11 is object
if (!isFunction(Location))
    LocationWrapper.toString = () => Location.toString();
else
    overrideStringRepresentation(LocationWrapper, Location);

