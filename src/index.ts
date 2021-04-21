import Proxy from './proxy';
import Session from './session';
import ResponseMock from './request-pipeline/request-hooks/response-mock';
import RequestFilterRule from './request-pipeline/request-hooks/request-filter-rule';
import UploadStorage from './upload/storage';
import { processScript, isScriptProcessed } from './processing/script';
import ConfigureResponseEventOptions from './session/events/configure-response-event-options';
import StateSnapshot from './session/state-snapshot';
import { SPECIAL_BLANK_PAGE, SPECIAL_ERROR_PAGE } from './utils/url';
import generateUniqueId from './utils/generate-unique-id';
import * as responseMockSetBodyMethod from './request-pipeline/request-hooks/response-mock/set-body-method';

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
    responseMockSetBodyMethod
};
