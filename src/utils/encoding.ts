import Charset from '../processing/encoding/charset';
import charsetEncoder from 'iconv-lite';

export function decodeBufferToString (content: Buffer, contentType: string) {
    const charset = new Charset();

    charset.fromContentType(contentType);

    return charsetEncoder.decode(content, charset.get());
}
export function encodeStringToBuffer (content: string, contentType: string) {
    const charset = new Charset();

    charset.fromContentType(contentType);

    return charsetEncoder.encode(content, charset.get());
}
