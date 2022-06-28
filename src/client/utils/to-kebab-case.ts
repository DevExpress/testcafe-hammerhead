const KEBAB_CASE_REGEX = /[A-Z]/g;

export default function (s: string): string {
    return s.replace(KEBAB_CASE_REGEX, match => `-${match.toLowerCase()}`);
}
