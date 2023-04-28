import Proxy from './proxy';
import Session from './session';
import ResponseMock from './request-pipeline/request-hooks/response-mock';
import RequestFilterRule from './request-pipeline/request-hooks/request-filter-rule';
import UploadStorage from './upload/storage';
import { inject } from './upload/index';
import { processScript, isScriptProcessed } from './processing/script';
import ConfigureResponseEventOptions from './request-pipeline/request-hooks/events/configure-response-event-options';
import StateSnapshot from './session/state-snapshot';
import {
    parseProxyUrl,
    sameOriginCheck,
    SPECIAL_BLANK_PAGE,
    SPECIAL_ERROR_PAGE,
} from './utils/url';
import generateUniqueId from './utils/generate-unique-id';
import * as responseMockSetBodyMethod from './request-pipeline/request-hooks/response-mock/set-body-method';
import RequestEvent from './request-pipeline/request-hooks/events/request-event';
import ResponseEvent from './request-pipeline/request-hooks/events/response-event';
import ConfigureResponseEvent from './request-pipeline/request-hooks/events/configure-response-event';
import DestinationRequest from './request-pipeline/destination-request';
import RequestOptions from './request-pipeline/request-options';
import promisifyStream from './utils/promisify-stream';
import PageProcessor from './processing/resources/page';
import { SCRIPTS } from './session/injectables';
import { acceptCrossOrigin } from './utils/http';
import getAssetPath from './utils/get-asset-path';
import RequestHookEventProvider from './request-pipeline/request-hooks/events/event-provider';
import { RequestInfo, ResponseInfo } from './request-pipeline/request-hooks/events/info';
import BaseRequestHookEventFactory from './request-pipeline/request-hooks/events/factory/base';
import BaseRequestPipelineContext from './request-pipeline/context/base';
import isRedirectStatusCode from './utils/is-redirect-status-code';
import * as contentTypeUtils from './utils/content-type';

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
    RequestHookEventProvider,
    BaseRequestHookEventFactory,
    BaseRequestPipelineContext,
    RequestInfo,
    promisifyStream,
    parseProxyUrl,
    sameOriginCheck,
    injectResources:    PageProcessor.injectResources,
    injectUpload:       inject,
    INJECTABLE_SCRIPTS: SCRIPTS,
    acceptCrossOrigin,
    getAssetPath,
    ResponseInfo,
    isRedirectStatusCode,
    contentTypeUtils,
};
