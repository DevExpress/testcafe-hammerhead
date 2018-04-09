import Proxy from './proxy';
import Session from './session';
import ResponseMock from './request-pipeline/request-hooks/response-mock';
import RequestFilterRule from './request-pipeline/request-hooks/request-filter-rule';
import { processScript, isScriptProcessed } from './processing/script';
import ConfigureResponseEventOptions from './session/events/configure-response-event-options';

export default {
    Proxy,
    Session,
    processScript,
    isScriptProcessed,
    ResponseMock,
    RequestFilterRule,
    ConfigureResponseEventOptions
};
