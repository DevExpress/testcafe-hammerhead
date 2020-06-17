import 'estree';

declare module 'estree' {
    interface BaseNode {
        start?: number;
        end?: number;
        originStart?: number;
        originEnd?: number;
        reTransform?: boolean;
    }
}
