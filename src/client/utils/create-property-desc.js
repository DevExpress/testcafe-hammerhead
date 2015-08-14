export default function createPropertyDesc (descBase) {
    descBase.configurable = true;
    descBase.enumerable   = true;

    return descBase;
}
