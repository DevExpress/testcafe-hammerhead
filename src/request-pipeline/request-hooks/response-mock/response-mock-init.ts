import RequestOptions from '../../request-options';

type ResponseMockPredicate = (req: RequestOptions, res: unknown) => void;

export type ResponseMockBodyInit = object | string | ResponseMockPredicate;

