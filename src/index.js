import Proxy from './proxy';
import Session from './session';
import { processScript } from './processing/script';

export default {
    Proxy:            Proxy,
    Session:          Session,
    wrapDomAccessors: code => processScript(code, false)
};
