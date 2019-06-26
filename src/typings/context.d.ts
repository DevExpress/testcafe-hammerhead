/*eslint-disable no-unused-vars*/
import RequestFilterRule from '../request-pipeline/request-hooks/request-filter-rule';
import ConfigureResponseEventOptions from '../session/events/configure-response-event-options';
/*eslint-enable no-unused-vars*/

export interface OnResponseEventData {
    rule: RequestFilterRule;
    opts: ConfigureResponseEventOptions;
}
