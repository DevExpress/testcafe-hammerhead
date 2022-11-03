const REDIRECT_STATUS_CODES = [301, 302, 303, 307, 308];

export default function (code: number): boolean {
    return REDIRECT_STATUS_CODES.includes(code);
}
