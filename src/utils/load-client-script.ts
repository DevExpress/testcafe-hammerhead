import SERVICE_ROUTES from '../proxy/service-routes';
import { readSync as read } from 'read-file-relative';
import getClientScriptSuffix from './get-client-script-suffix';

const serviceRouteValues = Object.values(SERVICE_ROUTES);

const loadedScriptsCache = {};

function get (key: string): string {
    if (loadedScriptsCache[key])
        return loadedScriptsCache[key];

    const script = read(key);

    loadedScriptsCache[key] = script;

    return script;
}

export default function (name: string, devMode: boolean): string {
    if (!serviceRouteValues.includes(name))
        throw new Error(`Unknown service route value: ${name}`);

    const parts      = name.split('.');
    const resultPath = `../client${parts[0]}${getClientScriptSuffix(devMode)}.${parts[1]}`;

    return get(resultPath);
}
