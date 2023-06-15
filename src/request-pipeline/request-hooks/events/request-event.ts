import RequestFilterRule from '../request-filter-rule';
import ResponseMock from '../response-mock';
import { RequestInfo } from './info';
import generateUniqueId from '../../../utils/generate-unique-id';
import RequestOptions from '../../request-options';
import { RequestInfoInit } from '../typings';


export default class RequestEvent {
    public readonly requestFilterRule: RequestFilterRule;
    private readonly _requestInfo: RequestInfo;
    private readonly reqOpts: RequestOptions;
    private readonly setMockFn: (responseEventId: string, mock: ResponseMock) => Promise<void>;
    public id: string;

    public constructor (init: RequestInfoInit) {
        Object.assign(this, init);
        this._setRequestOptionsTracking(this.reqOpts);

        this.id = generateUniqueId();
    }

    private _setRequestOptionsTracking (reqOpts: RequestOptions): void {
        reqOpts.on('headerChanged', changedHeader => {
            this._requestInfo.headers[changedHeader.name] = changedHeader.value;
        });

        reqOpts.on('headerRemoved', name => {
            delete this._requestInfo.headers[name];
        });
    }

    public async setMock (mock: ResponseMock): Promise<void> {
        await this.setMockFn(this.id, mock);
    }

    public get requestOptions (): RequestOptions | undefined {
        return this.reqOpts;
    }

    public get isAjax (): boolean {
        return this._requestInfo.isAjax;
    }
}
