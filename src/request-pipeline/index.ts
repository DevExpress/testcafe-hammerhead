import net from 'net';
import http from 'http';
import Session from '../session';
import { ServerInfo } from '../typings/proxy';
import RequestPipelineContext from './context';
import { respond404 } from '../utils/http';
import logger from '../utils/logger';
import requestPipelineStages from './stages';

export async function run (req: http.IncomingMessage, res: http.ServerResponse | net.Socket, serverInfo: ServerInfo, openSessions: Map<string, Session>, nativeAutomation: boolean): Promise<void> {
    const ctx = new RequestPipelineContext(req, res, serverInfo, nativeAutomation);

    logger.proxy.onRequest(ctx);

    if (!ctx.dispatch(openSessions)) {
        logger.proxy.onRequestError(ctx);

        respond404(res);

        return;
    }

    for (let i = 0; i < requestPipelineStages.length; i++) {
        await requestPipelineStages[i](ctx);

        if (!ctx.goToNextStage)
            return;
    }
}
