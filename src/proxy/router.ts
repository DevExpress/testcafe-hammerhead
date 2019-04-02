/*eslint-disable no-unused-vars*/
import net from 'net';
import http from 'http';
import { respondStatic } from '../utils/http';
import { StaticContent, ServerInfo } from '../typings/proxy';
/*eslint-enable no-unused-vars*/
import md5 from 'crypto-md5';
import { getPathname } from '../utils/url';

const PARAM_RE: RegExp = /^{(\S+)}$/;

interface Route {
    handler: StaticContent | Function,
    isStatic: boolean
}

interface RouteWithParams {
    handler: Function,
    paramNames: Array<string>,
    re: RegExp
}

function buildRouteParamsMap (routeMatch, paramNames) {
    return paramNames.reduce((params, paramName, i) => {
        params[paramName] = routeMatch[i + 1];
        return params;
    }, {});
}

export default abstract class Router {
    private readonly options: any;
    private readonly routes: Map<string, Route> = new Map();
    private readonly routesWithParams: Array<RouteWithParams> = [];

    protected constructor (options = {}) {
        this.options = options;
    }

    _registerRoute (route: string, method: string, handler: StaticContent | Function) {
        const tokens            = route.split('/');
        const isRouteWithParams = tokens.some(token => PARAM_RE.test(token));

        if (isRouteWithParams) {
            if (typeof handler === 'function')
                this._registerRouteWithParams(tokens, method, handler);
        }
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

    _registerRouteWithParams (tokens: Array<string>, method: string, handler: Function) {
        const paramNames = [];
        const reParts    = tokens.map(token => {
            const paramMatch = token.match(PARAM_RE);

            if (paramMatch) {
                paramNames.push(paramMatch[1]);
                return '(\\S+?)';
            }

            return token;
        });

        this.routesWithParams.push({ handler, paramNames, re: new RegExp(`^${method} ${reParts.join('/')}$`) });
    }

    _route (req: http.IncomingMessage, res: http.ServerResponse | net.Socket, serverInfo: ServerInfo): boolean {
        const routerQuery = `${req.method} ${getPathname(req.url)}`;
        const route       = this.routes.get(routerQuery);

        if (route) {
            if (route.isStatic)
                respondStatic(req, res, route.handler, this.options.staticContentCaching);
            else
                (<Function>route.handler)(req, res, serverInfo); // eslint-disable-line no-extra-parens

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

    abstract _processStaticContent (handler: StaticContent) : void;

    // API
    GET (route: string, handler: StaticContent | Function) {
        this._registerRoute(route, 'GET', handler);
    }

    POST (route: string, handler: StaticContent | Function) {
        this._registerRoute(route, 'POST', handler);
    }
}
