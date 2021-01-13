import { escape } from 'lodash';

export default function (err: object): string {
    const isError = err instanceof Error;

    return isError ? err.toString() : escape(String(err));
}
