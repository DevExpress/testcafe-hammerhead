const uniqueParameterPrefix        = '$$$e037c8b0';
const uniqueFormParameterPrefix    = uniqueParameterPrefix + '^^^form4b54';
const uniqueRequestParameterPrefix = uniqueFormParameterPrefix + '8558';

export const INTERNAL_REQUEST_PARAMETERS = {
    pendingRequestId: `${uniqueRequestParameterPrefix}pendingRequest`,
    formMethod:       `${uniqueFormParameterPrefix}formMethod`,
    formEnctype:      `${uniqueFormParameterPrefix}formEnctype`,
    sessionId:        `${uniqueParameterPrefix}sessionId`,
    referer:          `${uniqueParameterPrefix}referrer`,
    cmd:              `${uniqueParameterPrefix}cmd`
};
