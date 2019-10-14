import ResourceProcessorBase from './resource-processor-base';
import RequestPipelineContext from '../../request-pipeline/context';
import Charset from '../encoding/charset';

class ManifestProcessor extends ResourceProcessorBase {
    processResource (manifest: string, _ctx: RequestPipelineContext, _charset: Charset, urlReplacer: Function): string {
        const lines = manifest.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line && line !== 'CACHE MANIFEST' && line !== 'NETWORK:' && line !== 'FALLBACK:' &&
                line !== 'CACHE:' && line[0] !== '#' && line !== '*') {

                const isFallbackItem = line.includes(' ');

                if (isFallbackItem) {
                    const urls = line.split(' ');

                    lines[i] = urlReplacer(urls[0]) + ' ' + urlReplacer(urls[1]);
                }
                else
                    lines[i] = urlReplacer(line);
            }
        }

        return lines.join('\n');
    }

    shouldProcessResource (ctx: RequestPipelineContext): boolean {
        return ctx.contentInfo.isManifest;
    }
}

export default new ManifestProcessor();

