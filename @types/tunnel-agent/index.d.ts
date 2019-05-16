declare class TunnelingAgent {
    // public addRequest (req: http.IncomingMessage, options: { host: string, port: string, path: string }|string): void;
    //
    // public createConnection(pending: {host: string, port: string, request: http.IncomingMessage}): void;
    //
    // public createSocket(options: {host: string, port: string, request: http.IncomingMessage}, cb: Function): void;
    //
    // public removeSocket(socket: net.Socket): void;
}

declare module 'tunnel-agent' {
    export function httpsOverHttp (options: {
        proxy?: {
            host: string,
            hostname: string,
            bypassRules?: Array<string>,
            port?: string,
            proxyAuth?: string
        },
        maxSockets?: number
    }): TunnelingAgent;
}
