import Proxy from './proxy';
import Session from './session';
import jsProcessor from './processing/js-processor';
import * as ERRS from './errs';

export default {
    Proxy:            Proxy,
    Session:          Session,
    ERRS:             ERRS,
    wrapDomAccessors: jsProcessor.process
};
