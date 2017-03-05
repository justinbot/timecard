var TcAdmin = (function () {
    var tc = {};

    /* DOM elements */

    var inputAdmins,
        inputPeriodDuration,
        inputValidPeriodStart,
        inputViewDays,
        inputSlotIncrement,
        inputSlotFirstStart,
        inputSlotLastStart;

    /* local variables */

    var config = {}

    /* public variables */

    tc.init = function () {
        inputAdmins = document.getElementById("inputAdmins");
        inputPeriodDuration = document.getElementById("inputPeriodDuration");
        inputValidPeriodStart = document.getElementById("inputValidPeriodStart");
        inputViewDays = document.getElementById("inputViewDays");
        inputSlotIncrement = document.getElementById("inputSlotIncrement");
        inputSlotFirstStart = document.getElementById("inputSlotFirstStart");
        inputSlotLastStart = document.getElementById("inputSlotLastStart");

        dbUpdateUserSettings();
    }

    function dbUpdateUserSettings() {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/admin/settings/update", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            dbUpdateSettingsOnload(xhr.status, xhr.response);
        }
        xhr.send();
    }

    function dbUpdateSettingsOnload(status, response) {
        if (status == 200) {
            config = response;
            updateSettingsForms();
        } else {
            // TODO: Display error regarding status
        }
    }

    function dbSaveUserSettings() {
        var saveDict = {
            "admins": inputAdmins.value,
            "period_duration": inputPeriodDuration.value,
            "valid_period_start": inputValidPeriodStart.value,
            "view_days": inputViewDays.value,
            "slot_increment": inputSlotIncrement.value,
            "slot_first_start": inputSlotFirstStart.value,
            "slot_last_start": inputSlotLastStart.value
        };

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/admin/settings/save", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            dbUpdateSettingsOnload(xhr.status, xhr.response);
        }
        xhr.send(JSON.stringify(saveDict));
    }

    function updateSettingsForms() {
        inputAdmins.value = config["admins"];
        inputPeriodDuration.value = config["period_duration"];
        inputValidPeriodStart.value = config["valid_period_start"];
        inputViewDays.value = config["view_days"];
        inputSlotIncrement.value = config["slot_increment"];
        inputSlotFirstStart.value = config["slot_first_start"];
        inputSlotLastStart.value = config["slot_last_start"];
    }
    
    tc.saveSettings = function () {
        dbSaveUserSettings();
    }

    return tc;
})();
// Justin Carlson