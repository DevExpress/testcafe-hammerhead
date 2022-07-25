import Proxy from './proxy';
import Session from './session';
import ResponseMock from './request-pipeline/request-hooks/response-mock';
import RequestFilterRule from './request-pipeline/request-hooks/request-filter-rule';
import UploadStorage from './upload/storage';
import { processScript, isScriptProcessed } from './processing/script';
import ConfigureResponseEventOptions from './session/events/configure-response-event-options';
import StateSnapshot from './session/state-snapshot';
import {
    parseProxyUrl,
    sameOriginCheck,
    SPECIAL_BLANK_PAGE,
    SPECIAL_ERROR_PAGE,
} from './utils/url';
import generateUniqueId from './utils/generate-unique-id';
import * as responseMockSetBodyMethod from './request-pipeline/request-hooks/response-mock/set-body-method';
import RequestEvent from './session/events/request-event';
import ResponseEvent from './session/events/response-event';
import ConfigureResponseEvent from './session/events/configure-response-event';
import DestinationRequest from './request-pipeline/destination-request';
import RequestOptions from './request-pipeline/request-options';
import promisifyStream from './utils/promisify-stream';
import PageProcessor from './processing/resources/page';
import { SCRIPTS } from './session/injectables';
import { acceptCrossOrigin } from './utils/http';

export default {
    Proxy,
    Session,
    UploadStorage,
    processScript,
    isScriptProcessed,
    ResponseMock,
    RequestFilterRule,
    ConfigureResponseEventOptions,
    StateSnapshot,
    SPECIAL_BLANK_PAGE,
    SPECIAL_ERROR_PAGE,
    generateUniqueId,
    responseMockSetBodyMethod,
    RequestEvent,
    ConfigureResponseEvent,
    ResponseEvent,
    DestinationRequest,
    RequestOptions,
    promisifyStream,
    parseProxyUrl,
    sameOriginCheck,
    injectResources:    PageProcessor.injectResources,
    INJECTABLE_SCRIPTS: SCRIPTS,
    acceptCrossOrigin,
};
