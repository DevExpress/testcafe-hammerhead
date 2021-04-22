import { IncomingMessageLikeInitOptions } from '../../incoming-message-like';

const SET_BODY_METHOD_NAME = 'setBody';

export function add (res: IncomingMessageLikeInitOptions): void {
    res[SET_BODY_METHOD_NAME] = value => {
        res.body = value;
    };
}

export function remove (res: IncomingMessageLikeInitOptions): void {
    delete res[SET_BODY_METHOD_NAME];
}
