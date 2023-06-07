import net from 'net';
import http from 'http';
import { respondStatic } from '../utils/http';

import {
    StaticContent,
    ServerInfo,
    RouterOptions,
} from '../typings/proxy';

import md5 from 'crypto-md5';
import { getPathname } from '../utils/url';
import { isEqual } from 'lodash';
import logger from '../utils/logger';

const PARAM_RE = /^{(\S+)}$/;

interface Route {
    handler: StaticContent | Function;
    isStatic: boolean;
}

interface RouteWithParams {
    handler: Function;
    paramNames: string[];
    re: RegExp;
}

function buildRouteParamsMap (routeMatch, paramNames) {
    return paramNames.reduce((params, paramName, i) => {
        params[paramName] = routeMatch[i + 1];
        return params;
    }, {});
}

export default abstract class Router {
    public readonly options: RouterOptions;
    protected readonly routes: Map<string, Route> = new Map();
    private readonly routesWithParams: RouteWithParams[] = [];

    protected constructor (options: RouterOptions = {}) {
        this.options = options;
    }

    _registerRoute (route: string, method: string, handler: StaticContent | Function): void {
        logger.router('register route %s %s', method, route);

        const tokens            = route.split('/');
        const isRouteWithParams = tokens.some(token => PARAM_RE.test(token));

        if (isRouteWithParams && typeof handler === 'function')
            this._registerRouteWithParams(tokens, method, handler);
        else {
            const routeName = `${method} ${route}`;

            if (typeof handler !== 'function') {
                this._processStaticContent(handler);

                handler.etag = md5(handler.content);

                this.routes.set(routeName, { handler, isStatic: true });
            }
            else
                this.routes.set(routeName, { handler, isStatic: false });
        }
    }

    _prepareParamInfo (tokens: string[], method: string) {
        const paramNames = [] as string[];
        const reParts    = tokens.map(token => {
            const paramMatch = token.match(PARAM_RE);

            if (paramMatch) {
                paramNames.push(paramMatch[1]);
                return '(\\S+?)';
            }

            return token;
        });

        return {
            paramNames,
            re: new RegExp(`^${method} ${reParts.join('/')}$`),
        };
    }

    _registerRouteWithParams (tokens: string[], method: string, handler: Function): void {
        const { paramNames, re } = this._prepareParamInfo(tokens, method);

        this.routesWithParams.push({ handler, paramNames, re });
    }

    _unregisterRouteWithParams (tokens: string[], method: string): void {
        const { paramNames, re } = this._prepareParamInfo(tokens, method);

        const routeIndex = this.routesWithParams.findIndex(routeWithParam => {
            return isEqual(routeWithParam.re, re) && isEqual(routeWithParam.paramNames, paramNames);
        });

        if (routeIndex !== -1)
            this.routesWithParams.splice(routeIndex, 1);
    }

    _route (req: http.IncomingMessage, res: http.ServerResponse | net.Socket, serverInfo: ServerInfo): boolean {
        const routerQuery = `${req.method} ${getPathname(req.url || '')}`;
        const route       = this.routes.get(routerQuery);

        if (route) {
            if (route.isStatic)
                respondStatic(req, res, route.handler, this.options.staticContentCaching);
            else
                (route.handler as Function)(req, res, serverInfo);

            return true;
        }


        for (const routeWithParams of this.routesWithParams) {
            const routeMatch = routerQuery.match(routeWithParams.re);

            if (routeMatch) {
                const params = buildRouteParamsMap(routeMatch, routeWithParams.paramNames);

                routeWithParams.handler(req, res, serverInfo, params);

                return true;
            }
        }

        return false;
    }

    abstract _processStaticContent (handler: StaticContent): void;

    // API
    GET (route: string, handler: StaticContent | Function) {
        this._registerRoute(route, 'GET', handler);
    }

    POST (route: string, handler: StaticContent | Function) {
        this._registerRoute(route, 'POST', handler);
    }

    OPTIONS (route: string, handler: StaticContent | Function) {
        this._registerRoute(route, 'OPTIONS', handler);
    }

    unRegisterRoute (route: string, method: string): void {
        logger.router('unregister route %s %s', method, route);

        const tokens            = route.split('/');
        const isRouteWithParams = tokens.some(token => PARAM_RE.test(token));

        if (isRouteWithParams)
            this._unregisterRouteWithParams(tokens, method);

        const routeName = `${method} ${route}`;

        this.routes.delete(routeName);
    }
}
