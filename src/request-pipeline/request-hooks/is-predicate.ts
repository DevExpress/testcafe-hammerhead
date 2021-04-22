export default function (val: unknown): boolean {
    return typeof val === 'function';
}
