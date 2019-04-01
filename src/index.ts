import Proxy from './proxy';
import Session from './session';
import ResponseMock from './request-pipeline/request-hooks/response-mock';
import RequestFilterRule from './request-pipeline/request-hooks/request-filter-rule';
import UploadStorage from './upload/storage';
import { processScript, isScriptProcessed } from './processing/script';
import ConfigureResponseEventOptions from './session/events/configure-response-event-options';
import SAME_ORIGIN_CHECK_FAILED_STATUS_CODE from './request-pipeline/xhr/same-origin-check-failed-status-code';
import StateSnapshot from './session/state-snapshot';

export default {
    Proxy,
    Session,
    UploadStorage,
    processScript,
    isScriptProcessed,
    ResponseMock,
    RequestFilterRule,
    ConfigureResponseEventOptions,
    SAME_ORIGIN_CHECK_FAILED_STATUS_CODE,
    StateSnapshot
};
