// NOTE: We should store the methods of the `JSON` object
// since they can be overriden by the client code.
export const parseJSON     = JSON.parse;
export const stringifyJSON = JSON.stringify;
