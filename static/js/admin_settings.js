var TcAdmin = (function () {
    var tc = {};

    /* cached queries */
    var $loadingSpinner = $("#loadingSpinner"),
        $loadingCheck = $("#loadingCheck"),
        $loadingError = $("#loadingError");

    /* local variables */
    var config = {};
    var localConfig = {};

    tc.init = function () {
        loadSettings();
    }

    /*function dbSaveAdmins() {
        $loadingSpinner.show();
        $loadingCheck.hide();
        $loadingError.hide();

        var saveDict = {
            "admins": localConfig["admins"]
        };

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/admin/settings/save", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            $loadingSpinner.hide();

            if (xhr.status == 200) {
                $loadingCheck.show();
                loadSettings();
            } else {
                $loadingError.show();
            }
        }
        xhr.send(JSON.stringify(saveDict));
    }*/

    function saveAdmins() {
        $loadingSpinner.show();
        $loadingCheck.hide();
        $loadingError.hide();

        $.ajax({
                "method": "POST",
                "url": "/api/settings",
                "data": JSON.stringify({
                    "admins": localConfig["admins"]
                }),
                "contentType": "application/json; charset=utf-8",
                "dataType": "json"
            })
            .done(function (data, status, xhr) {
                $loadingSpinner.hide();
                $loadingCheck.show();
            })
            .fail(function (xhr, status, error) {
                $loadingSpinner.hide();
                $loadingError.show();
            }).always(function () {
                loadSettings();
            });
    }

    /*function dbSaveSettings() {
        $loadingSpinner.show();
        $loadingCheck.hide();
        $loadingError.hide();

        var saveDict = localConfig;

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/admin/settings/save", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            $loadingSpinner.show();

            if (xhr.status == 200) {
                $loadingCheck.show();
                dbUpdateSettings();
            } else {
                $loadingError.show();
            }
        }
        xhr.send(JSON.stringify(saveDict));
    }*/

    /*function dbUpdateSettings() {
        $loadingSpinner.show();
        $loadingCheck.hide();
        $loadingError.hide();

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/admin/settings/update", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            $loadingSpinner.hide();

            if (xhr.status == 200) {
                $loadingCheck.show();
                config = xhr.response;
                localConfig = {};
                updateSettingsForms();
            } else {
                $loadingError.show();
            }
        }
        xhr.send();
    }*/

    function saveSettings() {
        $loadingSpinner.show();
        $loadingCheck.hide();
        $loadingError.hide();


        $.ajax({
                "method": "POST",
                "url": "/api/settings",
                "data": JSON.stringify(localConfig),
                "contentType": "application/json; charset=utf-8",
                "dataType": "json"
            })
            .done(function (data, status, xhr) {
                $loadingSpinner.hide();
                $loadingCheck.show();
            })
            .fail(function (xhr, status, error) {
                $loadingSpinner.hide();
                $loadingError.show();
            }).always(function () {
                loadSettings();
            });
    }

    function loadSettings() {
        $loadingSpinner.show();
        $loadingCheck.hide();
        $loadingError.hide();


        $.ajax({
                "method": "GET",
                "url": "/api/settings"
            })
            .done(function (data, status, xhr) {
                $loadingSpinner.hide();
                $loadingCheck.show();

                config = data;
                localConfig = {};
                updateSettingsForms();
            })
            .fail(function (xhr, status, error) {
                $loadingSpinner.hide();
                $loadingError.show();
            });
    }

    function updateSettingsForms() {
        $("#inputPeriodDuration").val(config["period_duration"]);
        $("#inputValidPeriodStart").val(config["valid_period_start"]);
        $("#inputSlotIncrement").val(config["slot_increment"]);
        $("#inputViewDays").val(config["view_days"]);
        $("#inputDayStart").val(config["slot_first_start"]);
        $("#inputDayEnd").val(moment(config["slot_last_start"], "HH:mm").add(config["slot_increment"], "minute").format("HH:mm"));

        localConfig["admins"] = config["admins"];
        updateAdminsList();
        updateAdminsAddButton();

        updateSaveButton();
    }

    function updateAdminsList() {
        $("#adminsList").empty();
        $.each(localConfig["admins"], function (index, value) {
            $("<li>").addClass("list-group-item justify-content-between py-2")
                .append($("<span>").text(value))
                .append($("<button>", {
                    "type": "button",
                    "class": "btn btn-outline-danger btn-sm",
                    "text": "Remove",
                    "data-id": value
                }))
                .appendTo($("#adminsList"));
        });

        $("#adminsList").find(".btn").click(function () {
            // remove the admin id
            var index = $.inArray($(this).data("id"), localConfig["admins"]);
            if (index > -1) {
                localConfig["admins"].splice(index, 1);
            }
            saveAdmins();
        });
    }

    function updateAdminsAddButton() {
        var adminExists = $.inArray($("#inputAdminsAdd").val().toLowerCase(), config["admins"]) > -1;
        $("#adminsAddButton").prop("disabled", !($("#inputAdminsAdd").val().length > 0) || adminExists);
    }

    function updateSaveButton() {
        var isChanged = false;

        $.each(Object.keys(localConfig), function (index, value) {
            if (localConfig[value] != config[value]) {
                isChanged = true;
            }
        });

        $("#saveButton").prop("disabled", !isChanged);
    }

    $("#inputAdminsAdd").on("change paste keyup", function () {
        updateAdminsAddButton();
    });

    $("#adminsAddButton").click(function () {
        localConfig["admins"].push($("#inputAdminsAdd").val());
        $("#inputAdminsAdd").val("");
        saveAdmins();
    });

    $("#inputPeriodDuration").change(function () {
        localConfig["period_duration"] = $("#inputPeriodDuration").val();
        updateSaveButton();
    });

    $("#inputValidPeriodStart").change(function () {
        localConfig["valid_period_start"] = $("#inputValidPeriodStart").val();
        updateSaveButton();
    });

    $("#inputViewDays").change(function () {
        localConfig["view_days"] = $("#inputViewDays").val();
        updateSaveButton();
    });

    $("#inputSlotIncrement").change(function () {
        localConfig["slot_increment"] = $("#inputSlotIncrement").val();
        updateSaveButton();
    });

    $("#inputDayStart").change(function () {
        localConfig["slot_first_start"] = $("#inputDayStart").val();
        updateSaveButton();
    });

    $("#inputDayEnd").change(function () {
        localConfig["slot_last_start"] = moment($("#inputDayEnd").val(), "HH:mm").subtract(config["slot_increment"], "minute").format("HH:mm");
        updateSaveButton();
    });

    $("#saveButton").click(function () {
        saveSettings();
    });

    $("#purgeButton").click(function () {
        /*var xhr = new XMLHttpRequest();
        xhr.open("POST", "/admin/settings/purgedb", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            if (xhr.status == 200) {} else {}
        }
        xhr.send();*/
    });

    return tc;
})();
// Justin Carlson