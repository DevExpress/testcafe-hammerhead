import md5 from 'crypto-md5';
import { getPathname } from '../utils/url';
import { respondStatic } from '../utils/http';

// Const
const PARAM_RE = /^{(\S+)}$/;

// Static
function buildRouteParamsMap (routeMatch, paramNames) {
    return paramNames.reduce((params, paramName, i) => {
        params[paramName] = routeMatch[i + 1];
        return params;
    }, {});
}

const DEFAULT_CACHE_MAX_AGE = 30;

// Router
export default class Router {
    constructor ({ staticResourcesMaxAge } = {}) {
        this.routes           = {};
        this.routesWithParams = [];

        this.staticResourcesMaxAge = Number.isInteger(staticResourcesMaxAge) ? staticResourcesMaxAge : DEFAULT_CACHE_MAX_AGE;
    }

    _registerRoute (route, method, handler) {
        const tokens            = route.split('/');
        const isRouteWithParams = tokens.some(token => PARAM_RE.test(token));

        if (isRouteWithParams)
            this._registerRouteWithParams(tokens, method, handler);

        else {
            const isStatic = typeof handler !== 'function';

            if (isStatic) {
                this._processStaticContent(handler);

                handler.etag = md5(handler.content);
            }

            this.routes[`${method} ${route}`] = {
                handler:  handler,
                isStatic: isStatic
            };
        }
    }

    _registerRouteWithParams (tokens, method, handler) {
        const paramNames = [];
        const reParts    = tokens.map(token => {
            const paramMatch = token.match(PARAM_RE);

            if (paramMatch) {
                paramNames.push(paramMatch[1]);
                return '(\\S+?)';
            }

            return token;
        });

        this.routesWithParams.push({
            paramNames: paramNames,

            re:      new RegExp(`^${method} ${reParts.join('/')}$`),
            handler: handler
        });
    }

    _route (req, res, serverInfo) {
        const routerQuery = `${req.method} ${getPathname(req.url)}`;
        let route         = this.routes[routerQuery];

        if (route) {
            if (route.isStatic)
                respondStatic(req, res, route.handler, { cacheMaxAge: this.staticResourcesMaxAge });

            else
                route.handler(req, res, serverInfo);

            return true;
        }


        for (let i = 0; i < this.routesWithParams.length; i++) {
            route = this.routesWithParams[i];

            const routeMatch = routerQuery.match(route.re);

            if (routeMatch) {
                const params = buildRouteParamsMap(routeMatch, route.paramNames);

                route.handler(req, res, serverInfo, params);
                return true;
            }
        }

        return false;
    }

    _processStaticContent () {
        throw new Error('Not implemented');
    }

    // API
    GET (route, handler) {
        this._registerRoute(route, 'GET', handler);
    }

    POST (route, handler) {
        this._registerRoute(route, 'POST', handler);
    }
}
