const settings = {
    settings: {},

    set: function (value: any) {
        this.settings = value;
    },

    get: function () {
        return this.settings;
    }
};

export default settings;
