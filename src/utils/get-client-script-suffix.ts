export default function (devMode: boolean): string {
    return devMode ? '' : '.min';
}
