import ResourceProcessorBase from './resource-processor-base';
import { trim } from '../../utils/util';

class ManifestProcessor extends ResourceProcessorBase {
    processResource (manifest, ctx, charset, urlReplacer) {
        var lines = manifest.split('\n');

        for (var i = 0; i < lines.length; i++) {
            var line = trim(lines[i]);

            if (line && line !== 'CACHE MANIFEST' && line !== 'NETWORK:' && line !== 'FALLBACK:' &&
                line !== 'CACHE:' && line[0] !== '#' && line !== '*') {

                var isFallbackItem = line.indexOf(' ') !== -1;

                /*eslint-disable indent*/
                if (isFallbackItem) {
                    var urls = line.split(' ');

                    lines[i] = urlReplacer(urls[0]) + ' ' + urlReplacer(urls[1]);
                }
                else
                    lines[i] = urlReplacer(line);
                /*eslint-enable indent*/
            }
        }

        return lines.join('\n');
    }

    shouldProcessResource (ctx) {
        return ctx.contentInfo.isManifest;
    }
}

export default new ManifestProcessor();

