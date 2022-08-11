import SERVICE_ROUTES from '../proxy/service-routes';
import { readSync as read } from 'read-file-relative';
import getAssetPath from './get-asset-path';

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

    const resultPath = `../client${getAssetPath(name, devMode)}`;

    return get(resultPath);
}
