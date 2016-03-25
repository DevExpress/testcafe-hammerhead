import md5 from 'crypto-md5';
import { getPathname } from '../utils/url';
import { respondStatic } from '../utils/http';
import { isFunction } from '../utils/types';

// Const
const PARAM_RE = /^{(\S+)}$/;

// Static
function buildRouteParamsMap (routeMatch, paramNames) {
    return paramNames.reduce((params, paramName, i) => {
        params[paramName] = routeMatch[i + 1];
        return params;
    }, {});
}

// Router
export default class Router {
    constructor () {
        this.routes           = {};
        this.routesWithParams = [];
    }

    _registerRoute (route, method, handler) {
        var tokens            = route.split('/');
        var isRouteWithParams = tokens.some(token => PARAM_RE.test(token));

        if (isRouteWithParams)
            this._registerRouteWithParams(tokens, method, handler);

        else {
            var isStatic = !isFunction(handler);

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
        var paramNames = [];
        var reParts    = tokens.map(token => {
            var paramMatch = token.match(PARAM_RE);

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
        var routerQuery = `${req.method} ${getPathname(req.url)}`;
        var route       = this.routes[routerQuery];

        if (route) {
            if (route.isStatic)
                respondStatic(req, res, route.handler);

            else
                route.handler(req, res, serverInfo);

            return true;
        }


        for (var i = 0; i < this.routesWithParams.length; i++) {
            route = this.routesWithParams[i];

            var routeMatch = routerQuery.match(route.re);

            if (routeMatch) {
                var params = buildRouteParamsMap(routeMatch, route.paramNames);

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
