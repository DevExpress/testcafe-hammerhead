import RequestFilterRule from '../request-pipeline/request-hooks/request-filter-rule';
import ConfigureResponseEventOptions from '../session/events/configure-response-event-options';

export interface OnResponseEventData {
    rule: RequestFilterRule;
    opts: ConfigureResponseEventOptions;
}
