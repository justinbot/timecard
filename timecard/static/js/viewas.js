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

    /* local variables */
    var focusDate;
    var periodStart,
        periodEnd;

    var selectedTimestamps = new Set();

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
        dbUpdate();
        updateHeaderDates();
        updatePeriod();
    }

    function updateHeaderDates() {
        $tcHeaders.each(function (index, element) {
            var headerDate = moment(periodStart).add(index, "day");
            $(element).data("start", headerDate.unix());
            $(element).data("end", moment(headerDate).endOf("day").unix());
            $(element).children().eq(0).html(headerDate.format("ddd"));
            $(element).children().eq(1).html(headerDate.format("MMM D"));
        })
    }

    function updateHeaderHours() {
        $tcHeaders.each(function (index, element) {
            var hours = 0.0;
            var dayStart = $(element).data("start");
            var dayEnd = $(element).data("end");

            for (var ts of selectedTimestamps) {
                if (ts >= dayStart && ts <= dayEnd) {
                    hours += (tc.slotIncrement / 60);
                }
            }

            $(element).children().eq(2).html(hours.toFixed(1) + " hours");
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
                    "data-timestamp": newTime.unix()
                });

                // Slot is selected if: selected locally, or selected on server and not unselected locally
                if (timestampSelected($newSlot.data("timestamp").toString())) {
                    $newSlot.attr("class", "slot-selected locked");
                } else {
                    // if slot time is before first start times, lock it
                    if (slotTime.hour() < tc.slotFirstStart.hour() || (slotTime.hour() == tc.slotFirstStart.hour() && slotTime.minute() < tc.slotFirstStart.minute())) {
                        $newSlot.attr("class", "slot locked");
                    } else {
                        $newSlot.attr("class", "slot locked");
                    }
                }

                $dayStack.append($newSlot);
            }
        }

        $oldTcBody.replaceWith($newTcBody);
    }

    function updatePeriod() {
        $("#periodNavToday").prop("disabled", focusDate.isSame(tc.initialDate, "day"));

        var startDate = moment(periodStart);
        var endDate = moment(periodEnd);
        if (startDate.isSame(endDate, "year")) {
            if (startDate.isSame(endDate, "month")) {
                $periodRange.html(startDate.format("MMM D") + "–" + endDate.format("D, YYYY"));
            } else {
                $periodRange.html(startDate.format("MMM D") + "–" + endDate.format("MMM D, YYYY"));
            }
        } else {
            $periodRange.html(startDate.format("MMM D, YYYY") + "–" + endDate.format("MMM D, YYYY"));
        }
    }

    function dbUpdate() {
        $loadingSpinner.show();
        $loadingCheck.hide();
        $loadingError.hide();

        var updateDict = {
            "id": tc.userId,
            "range": [moment(periodStart).startOf("day").unix(), moment(periodEnd).endOf("day").unix()]
        };

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/user/update", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            $loadingSpinner.hide();

            if (xhr.status == 200) {
                $loadingCheck.show();
                $tcStatus.text("Last modified " + moment(xhr.response["lastmodified"]).from(tc.initialDate));

                selectedTimestamps = new Set();
                for (var i = 0; i < xhr.response["selected"].length; i++) {
                    selectedTimestamps.add(xhr.response["selected"][i]);
                }
                onTimestampsChanged();
            } else {
                $loadingError.show();
            }
        }
        xhr.send(JSON.stringify(updateDict));
    }

    function timestampSelected(ts) {
        ts = ts.toString();
        return selectedTimestamps.has(ts);
    }

    $("#periodNavPrev").on("click", function () {
        prevPeriod();
    });

    $("#periodNavToday").on("click", function () {
        currentPeriod();
    });

    $("#periodNavNext").on("click", function () {
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

    return tc;
})();
// Justin Carlson