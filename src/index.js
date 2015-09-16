import Proxy from './proxy';
import Session from './session';
import jsProcessor from './processing/js';

export default {
    Proxy:            Proxy,
    Session:          Session,
    wrapDomAccessors: (code, beautify) => jsProcessor.process(code, beautify)
};
