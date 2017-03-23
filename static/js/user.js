var TcUser = (function () {
    var tc = {};

    /* cached queries */
    var $loadingSpinner = $("#loadingSpinner"),
        $loadingCheck = $("#loadingCheck"),
        $loadingError = $("#loadingError");

    var $periodRange = $("#periodRange");

    var $tcTable = $("#tcTable"),
        $tcHead = $("#tcHead"),
        $tcHeaders;

    var $tcStatus = $("#tcStatus");

    var $buttonNewTemplate = $("#buttonNewTemplate"),
        $dropdownSelectTemplate = $("#dropdownSelectTemplate"),
        $menuSelectTemplate = $("#menuSelectTemplate"),
        $inputTemplateName = $("#inputTemplateName"),
        $buttonCancelTemplate = $("#buttonCancelTemplate"),
        $buttonSaveTemplate = $("#buttonSaveTemplate");

    /* local variables */
    var focusDate;
    var periodStart,
        periodEnd;

    var localSelectedTimestamps = new Set();
    var localUnselectedTimestamps = new Set();
    var selectedTimestamps;

    var templates;
    // TODO: Store selected template, nullify when changed

    var slotDown;
    var slotToggleTo;

    /* public variables */
    tc.initialDate;
    tc.validPeriodStart;
    tc.periodDuration;
    tc.lockDate;
    tc.slotIncrement;
    tc.slotFirstStart;
    tc.slotLastStart;

    tc.init = function () {
        var tcHeaders = [];
        for (var i = 0; i < tc.periodDuration; i++) {
            tcHeaders.push($("#tcHeader" + i));
        }
        $tcHeaders = $(tcHeaders);

        hideNewTemplate();

        currentPeriod();
    }

    function onTimestampsChanged() {
        updateTable();
        updateHeaderHours();

        for (var i = 0; i < tc.periodDuration; i++) {
            updateDayBlocks(i);
        }
    }

    function onPeriodChanged() {
        // TODO: ...
        $("#buttonSelectTemplate").text("None");
        
        dbUpdate();
        updateHeaderDates();
        updatePeriod();
    }

    function updateHeaderDates() {
        $tcHeaders.each(function (index, element) {
            var headerDate = moment(periodStart).add(index, "day");
            $(element).data("start", headerDate.unix());
            $(element).data("end", moment(headerDate).endOf("day").unix());
            $(element).children().eq(0).text(headerDate.format("ddd"));
            $(element).children().eq(1).text(headerDate.format("MMM D"));
        })
    }

    function updateHeaderHours() {
        $tcHeaders.each(function (index, element) {
            var hours = 0.0;
            var dayStart = $(element).data("start");
            var dayEnd = $(element).data("end");

            for (var ts of selectedTimestamps) {
                if (ts >= dayStart && ts <= dayEnd) {
                    if (!localUnselectedTimestamps.has(ts)) {
                        hours += (tc.slotIncrement / 60);
                    }
                }
            }

            for (var ts of localSelectedTimestamps) {
                // avoid double counting timestamps
                if (!selectedTimestamps.has(ts)) {
                    if (ts >= dayStart && ts <= dayEnd) {
                        hours += (tc.slotIncrement / 60);
                    }
                }
            }

            $(element).children().eq(2).text(hours.toFixed(1) + " hours");

            /*$.each(selectedTimestamps, function (ind, value) {
                if (value >= $(element).data("start") && value <= $(element).data("end")) {
                    if (!localUnselectedTimestamps.has(value)) {
                        hours += (tc.slotIncrement / 60);
                    }
                }
            });

            $.each(localSelectedTimestamps, function (ind, value) {
                if (value >= $(element).data("start") && value <= $(element).data("end")) {
                    hours += (tc.slotIncrement / 60);
                }
            });

            $(element).children().eq(2).text(hours.toFixed(1) + " hours");*/
        });
    }

    function updateDayBlocks(index) {
        var day = $("#tcDay" + index);

        var blockStartTime;

        day.children().each(function (index, element) {
            var slot = $(element);

            slot.text("");
            slot.removeClass("rounded-top");
            slot.removeClass("rounded-bottom");

            var lastSlot = (index == day.children().length - 1);
            var prevSlotSelected = index > 0 && timestampSelected(day.children().eq(index - 1).data("timestamp"));
            var slotSelected = timestampSelected(slot.data("timestamp"));
            var nextSlotSelected = !lastSlot && timestampSelected(day.children().eq(index + 1).data("timestamp"));

            var blockStart = slotSelected && !prevSlotSelected;
            var blockEnd = slotSelected && !nextSlotSelected;

            if (blockStart) {
                slot.addClass("rounded-top");

                blockStartTime = moment.unix(slot.data("timestamp"));

                blockLabel = $("<div>", {
                    class: "blocklabel",
                    html: ""
                });
                slot.append(blockLabel);
            }

            if (blockEnd) {
                slot.addClass("rounded-bottom");

                var blockEndTime = moment.unix(slot.data("timestamp")).add(tc.slotIncrement, "minute");
                var blockDuration = moment.duration(blockEndTime.diff(blockStartTime));

                // Show duration label for blocks of an hour or more
                if (blockDuration.asHours() >= 1) {
                    // If start and end are same meridiem
                    if (blockStartTime.format("a") === blockEndTime.format("a")) {
                        blockLabel.text(blockStartTime.format("h:mm") + "– " + blockEndTime.format("h:mma"));
                    } else {
                        blockLabel.text(blockStartTime.format("h:mma") + "– " + blockEndTime.format("h:mma"));
                    }
                }
            }
        });
    }

    function updateTable() {
        var $oldTcBody = $("#tcBody");
        var $newTcBody = $("<tbody>", {
            id: "tcBody"
        });

        var $tcRow = $("<tr>");
        $newTcBody.append($tcRow);

        var slotTimes = [];
        var slotTime = moment(tc.slotFirstStart).startOf("hour");
        var endTime = moment(tc.slotLastStart).endOf("hour");
        while (slotTime.isBefore(endTime)) {
            slotTimes.push(moment(slotTime));
            slotTime.add(tc.slotIncrement, "minute");
        }

        var $hoursCell = $("<td>");
        $tcRow.append($hoursCell);
        var $hoursStack = $("<div>", {
            class: "slot-stack"
        });
        $hoursCell.append($hoursStack);

        // Add hour marks in first column
        for (var i = 0; i < slotTimes.length; i++) {
            if (slotTimes[i].minute() == 0) {
                $hoursStack.append($("<div>", {
                    "class": "text-muted hour-mark",
                    "html": slotTimes[i].format("ha")
                }));
            }
        }

        for (var i = 0; i < tc.periodDuration; i++) {
            var dayTime = moment(periodStart).add(i, "day");

            var $dayCell = $("<td>", {
                class: "day-cell"
            });
            $tcRow.append($dayCell);

            // Highlight current day
            if (dayTime.isSame(tc.initialDate, "day")) {
                $dayCell.css("background-color", "#f4f4f4");
            }

            var $dayStack = $("<div>", {
                class: "slot-stack",
                id: "tcDay" + i,
                "data-day": i
            });
            $dayCell.append($dayStack);

            for (j = 0; j < slotTimes.length; j++) {
                var slotTime = slotTimes[j];
                var newTime = moment(dayTime).hour(slotTime.hour()).minute(slotTime.minute()).second(0);

                var $newSlot = $("<div>", {
                    id: i + "-" + newTime.format("HH:mm"),
                    "data-timestamp": newTime.unix()
                });

                // Slot is selected if: selected locally, or selected on server and not unselected locally
                if (timestampSelected($newSlot.data("timestamp").toString())) {
                    $newSlot.attr("class", "slot-selected");
                } else {
                    // if slot time is before first start times, lock it
                    if (slotTime.hour() < tc.slotFirstStart.hour() || (slotTime.hour() == tc.slotFirstStart.hour() && slotTime.minute() < tc.slotFirstStart.minute())) {
                        $newSlot.attr("class", "slot locked");
                    } else {
                        $newSlot.attr("class", "slot");
                    }
                }

                $dayStack.append($newSlot);
            }
        }

        $oldTcBody.replaceWith($newTcBody);
    }

    function updatePeriod() {
        $("#buttonPeriodToday").prop("disabled", focusDate.isSame(tc.initialDate, "day"));

        var startDate = moment(periodStart);
        var endDate = moment(periodEnd);
        if (startDate.isSame(endDate, "year")) {
            if (startDate.isSame(endDate, "month")) {
                $periodRange.text(startDate.format("MMM D") + "–" + endDate.format("D, YYYY"));
            } else {
                $periodRange.text(startDate.format("MMM D") + "–" + endDate.format("MMM D, YYYY"));
            }
        } else {
            $periodRange.text(startDate.format("MMM D, YYYY") + "–" + endDate.format("MMM D, YYYY"));
        }
    }

    function dbUpdate() {
        $loadingSpinner.show();
        $loadingCheck.hide();
        $loadingError.hide();

        var updateDict = {
            "range": [moment(periodStart).startOf("day").unix(), moment(periodEnd).endOf("day").unix()]
        };

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/update", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            $loadingSpinner.hide();

            if (xhr.status == 200) {
                $loadingCheck.show();
                $tcStatus.text("Last modified " + moment(xhr.response["lastmodified"]).fromNow()); // TODO: Use initialMoment, localInitialMoment and moment() to accurate use .from(getDbMoment())

                //localSelectedTimestamps = new Set();
                //localUnselectedTimestamps = new Set();

                selectedTimestamps = new Set();
                for (var i = 0; i < xhr.response["selected"].length; i++) {
                    selectedTimestamps.add(xhr.response["selected"][i]);
                }
                onTimestampsChanged();
            } else {
                $loadingError.show();
                // TODO: Tooltip with error
            }
        }
        xhr.send(JSON.stringify(updateDict));

        dbLoadTemplates();
    }

    function dbSave() {
        // TODO***: Blocks are broken after saving
        // Abort save if nothing is changed
        if (!(localSelectedTimestamps.size > 0 || localUnselectedTimestamps.size > 0)) {
            return;
        }

        $tcStatus.text("Saving...");

        var saveDict = {};
        if (localSelectedTimestamps.size > 0) {
            saveDict["selected"] = Array.from(localSelectedTimestamps);
        }
        if (localUnselectedTimestamps.size > 0) {
            saveDict["unselected"] = Array.from(localUnselectedTimestamps);
        }

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/save", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            dbUpdate();
            if (xhr.status == 200) {
                $tcStatus.text("All changes saved");
            } else {
                $tcStatus.text("Failed to save changes");
            }
        }
        xhr.send(JSON.stringify(saveDict));
        /*$.each(localSelectedTimestamps, function (index, value) {
            selectedTimestamps.add(value);
        });

        $.each(localUnselectedTimestamps, function (index, value) {
            selectedTimestamps.delete(value);
        });

        localSelectedTimestamps = new Set();
        localUnselectedTimestamps = new Set();*/
    }

    function dbLoadTemplates() {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/update/templates", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.responseType = "json";
        xhr.onload = function () {
            if (xhr.status == 200) {
                templates = xhr.response["templates"];
                updateTemplatesSelect();
            } else {

            }
        }
        xhr.send();
    }

    function dbSaveTemplates() {
        var saveDict = {
            templates: templates
        }

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/save/templates", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.responseType = "json";
        xhr.onload = function () {
            if (xhr.status == 200) {
                // TODO: Display 'successfully saved new template' banner
            } else {
                // TODO: Display 'failed to save new template' banner
            }
            dbLoadTemplates();
        }
        xhr.send(JSON.stringify(saveDict));
    }

    function updateTemplatesSelect() {
        $menuSelectTemplate.empty();

        // "None" option for no template
        $menuSelectTemplate.append($("<button>", {
            class: "dropdown-item",
            text: "None",
            "data-index": -1
        }));

        $menuSelectTemplate.append($("<div>", {
            class: "dropdown-divider"
        }));

        for (var i = 0; i < templates.length; i++) {
            var template = templates[i];

            $menuSelectTemplate.append($("<button>", {
                class: "dropdown-item",
                text: template["name"],
                "data-index": i
            }));
        }
    }

    $menuSelectTemplate.on("click", ".dropdown-item", function () {
        var index = $(this).data("index");

        if (index > -1) {
            applyTemplate(templates[index]);
            $("#buttonSelectTemplate").text(templates[index]["name"]);
        } else {
            $("#buttonSelectTemplate").text("None");
        }
    });

    $tcTable.on("mouseleave", ".day-cell", function () {
        slotDown = false;
    });

    $tcTable.on("mousedown", ".slot, .slot-selected", function () {
        slotDown = true;
        slotToggleTo = !timestampSelected($(this).data("timestamp").toString());

        slotMouseOver($(this));
    });

    $tcTable.on("mouseup", ".slot, .slot-selected", function () {
        slotDown = false;
    });

    $tcTable.on("mouseover", ".slot, .slot-selected", function () {
        slotMouseOver($(this));
    });

    function slotMouseOver(slot) {
        if (!slotDown) {
            return;
        }

        var slotTimestamp = slot.data("timestamp").toString();

        if (slotToggleTo) {
            // changing slots to selected, only if not already selected
            if (!timestampSelected(slotTimestamp)) {
                slot.attr("class", "slot-selected")
                selectTimestamp(slotTimestamp);
                updateHeaderHours();
                updateDayBlocks(slot.parent().data("day"));
            }
        } else {
            // changing slots to unselected, only if already selected
            if (timestampSelected(slotTimestamp)) {
                slot.attr("class", "slot")
                unselectTimestamp(slotTimestamp);
                updateHeaderHours();
                updateDayBlocks(slot.parent().data("day"));
            }
        }
    }

    $("#buttonSave").click(function () {
        dbSave();
    });

    function selectTimestamp(ts) {
        if (!selectedTimestamps.has(ts)) {
            localSelectedTimestamps.add(ts);
        }
        if (localUnselectedTimestamps.has(ts)) {
            localUnselectedTimestamps.delete(ts);
        }
    }

    function unselectTimestamp(ts) {
        if (selectedTimestamps.has(ts)) {
            localUnselectedTimestamps.add(ts);
        }
        if (localSelectedTimestamps.has(ts)) {
            localSelectedTimestamps.delete(ts);
        }
    }

    function timestampSelected(ts) {
        ts = ts.toString();
        return (selectedTimestamps.has(ts) && !localUnselectedTimestamps.has(ts)) || localSelectedTimestamps.has(ts);
    }

    $("#buttonPeriodPrev").on("click", function () {
        prevPeriod();
    });

    $("#buttonPeriodToday").on("click", function () {
        currentPeriod();
    });

    $("#buttonPeriodNext").on("click", function () {
        nextPeriod();
    });

    function prevPeriod() {
        focusDate.subtract(tc.periodDuration, "day");
        periodStart.subtract(tc.periodDuration, "day");
        periodEnd.subtract(tc.periodDuration, "day");

        onPeriodChanged();
    }

    function currentPeriod() {
        focusDate = moment(tc.initialDate);
        periodStart = moment(tc.validPeriodStart);
        // Calculate start of the period the initialDate is in
        periodStart.add(Math.floor((focusDate.unix() - periodStart.unix()) / 60 / 60 / 24 / tc.periodDuration) * tc.periodDuration, "day");
        periodEnd = moment(periodStart).add(tc.periodDuration - 1, "day").endOf("day");

        onPeriodChanged();
    }

    function nextPeriod() {
        focusDate.add(tc.periodDuration, "day");
        periodStart.add(tc.periodDuration, "day");
        periodEnd.add(tc.periodDuration, "day");

        onPeriodChanged();
    }

    $buttonNewTemplate.click(function () {
        showNewTemplate();
    });

    $buttonCancelTemplate.click(function () {
        hideNewTemplate();
    });

    $buttonSaveTemplate.click(function () {
        var newTemplate = createTemplate($inputTemplateName.val())
        templates.push(newTemplate);
        dbSaveTemplates();
        hideNewTemplate();
    });

    $inputTemplateName.on("change paste keyup", function () {
        $buttonSaveTemplate.prop("disabled", !($inputTemplateName.val().length > 2));
    });

    //$("#buttonEditTemplate").click(function () {});

    //$("#buttonDeleteTemplate").click(function () {});

    function showNewTemplate() {
        $buttonNewTemplate.hide();
        $dropdownSelectTemplate.hide();
        $inputTemplateName.show();
        $inputTemplateName.focus();
        $buttonCancelTemplate.show();
        $buttonSaveTemplate.prop("disabled", true);
        $buttonSaveTemplate.show();
    }

    function hideNewTemplate() {
        $buttonNewTemplate.show();
        $dropdownSelectTemplate.show();
        $inputTemplateName.hide();
        $inputTemplateName.val("");
        $buttonCancelTemplate.hide();
        $buttonSaveTemplate.hide();
    }

    function createTemplate(name) {
        // TODO: Should really operate on data, not elements
        var newTemplate = {
            name: name,
            timeblocks: []
        };

        for (var dayIndex = 0; dayIndex < tc.periodDuration; dayIndex++) {
            var day = $("#tcDay" + dayIndex);

            var blockStartTime;

            day.children().each(function (index, element) {
                var slot = $(element);

                var lastSlot = (index == day.children().length - 1);
                var prevSlotSelected = index > 0 && timestampSelected(day.children().eq(index - 1).data("timestamp"));
                var slotSelected = timestampSelected(slot.data("timestamp"));
                var nextSlotSelected = !lastSlot && timestampSelected(day.children().eq(index + 1).data("timestamp"));

                var blockStart = slotSelected && !prevSlotSelected;
                var blockEnd = slotSelected && !nextSlotSelected;

                if (blockStart) {
                    blockStartTime = moment.unix(slot.data("timestamp"));
                }

                if (blockEnd) {
                    var blockEndTime = moment.unix(slot.data("timestamp")).add(tc.slotIncrement, "minute");
                    var blockDuration = moment.duration(blockEndTime.diff(blockStartTime));

                    var blockString = dayIndex + "-" + blockStartTime.format("HH:mm") + "-" + blockDuration.asMinutes();
                    newTemplate["timeblocks"].push(blockString);
                }
            });
        }

        return newTemplate;
    }

    function applyTemplate(template) {
        // TODO: Make use of moment.duration to avoid DST issues
        // TODO: Rework this behavior to be more robust regarding local selections, template nullifying, etc.
        localUnselectedTimestamps = new Set();
        localSelectedTimestamps = new Set();

        // deselect all slots
        /*$(".slot, .slot-selected").each(function (index, element) {
            var slot = $(element);
            if (timestampSelected(slot.data("timestamp"))) {
                slot.attr("class", "slot")
                unselectTimestamp(slot.data("timestamp"));
            }
        });*/
        
        for (var ts of selectedTimestamps) {
            unselectTimestamp(ts);
        }

        $.each(template["timeblocks"], function (index, value) {
            var block = value.split("-");
            var dayIndex = block[0];
            var startTime = moment(block[1], "HH:mm");
            var duration = parseInt(block[2]);

            while (duration > 0) {
                // select the slot
                // selector has to be escaped due to "-" and ":"
                var id = $.escapeSelector(dayIndex + "-" + startTime.format("HH:mm"));
                var slot = $("#" + id);
                //slot.attr("class", "slot-selected")
                //selectTimestamp(slot.data("timestamp"));
                //localSelectedTimestamps.add();

                selectTimestamp(slot.data("timestamp").toString())
                
                startTime.add(tc.slotIncrement, "minute");
                duration -= tc.slotIncrement;
            }
        });

        onTimestampsChanged();
    }

    return tc;
})();
// Justin Carlson