var TcUser = (function () {
    var tc = {};

    /* cached queries */
    var $loadingSpinner = $("#loadingSpinner"),
        $loadingCheck = $("#loadingCheck"),
        $loadingError = $("#loadingError");

    /* local variables */
    var focusDate;
    var periodStart,
        periodEnd;


    // Changes should only take place within currently viewed period
    // On changing period, changes should be auto-saved
    // Hour blocks, 2-value arrays of [start timestamp, end timestamp]
    var timestamps; // set of timestamps as pulled from the server
    var localTimestamps; // set of timestamps as changed locally

    /* public variables */
    tc.userId;
    tc.initialDate;
    tc.initialPeriodStart;
    tc.periodDuration;
    tc.lockDate;
    tc.slotIncrement;
    tc.slotFirstStart;

    tc.init = function () {
        currentPeriod();
    }

    function onPeriodChanged() {
        loadTimestamps();

        $("#buttonPeriodToday").prop("disabled", focusDate.isSame(tc.initialDate, "day"));

        var startDate = moment(periodStart);
        var endDate = moment(periodEnd);
        if (startDate.isSame(endDate, "year")) {
            if (startDate.isSame(endDate, "month")) {
                $("#periodRange").text(startDate.format("MMM D") + "–" + endDate.format("D, YYYY"));
            } else {
                $("#periodRange").text(startDate.format("MMM D") + "–" + endDate.format("MMM D, YYYY"));
            }
        } else {
            $("#periodRange").text(startDate.format("MMM D, YYYY") + "–" + endDate.format("MMM D, YYYY"));
        }
    }

    function prevPeriod() {
        focusDate.subtract(tc.periodDuration, "day");
        periodStart.subtract(tc.periodDuration, "day");
        periodEnd.subtract(tc.periodDuration, "day");

        onPeriodChanged();
    }

    function currentPeriod() {
        focusDate = moment(tc.initialDate);
        periodStart = tc.initialPeriodStart;
        periodEnd = moment(periodStart).add(tc.periodDuration - 1, "day").endOf("day");
        
        //periodStart = moment(tc.validPeriodStart);

        // Calculate start of the period the initialDate is in
        //periodStart.add(Math.floor((focusDate.unix() - periodStart.unix()) / 60 / 60 / 24 / tc.periodDuration) * tc.periodDuration, "day");
        //periodEnd = moment(periodStart).add(tc.periodDuration - 1, "day").endOf("day");

        onPeriodChanged();
    }

    function nextPeriod() {
        focusDate.add(tc.periodDuration, "day");
        periodStart.add(tc.periodDuration, "day");
        periodEnd.add(tc.periodDuration, "day");

        onPeriodChanged();
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

    function loadTimestamps() {
        $loadingSpinner.show();
        $loadingCheck.hide();
        $loadingError.hide();

        $.ajax({
                "method": "GET",
                "url": "/api/users/" + tc.userId + "/hours",
                "data": {
                    "start": moment(periodStart).startOf("day").unix().toString(),
                    "end": moment(periodEnd).endOf("day").unix().toString()
                },
                "dataType": "json"
            })
            .done(function (json) {
                $loadingSpinner.hide();
                $loadingCheck.show();
                
                // User 'last_modified' is in UTC, convert to local for display
                $("#tcStatus").text("Last modified " + moment.utc(data["last_modified"])).local().fromNow());

                /*// data["timeblocks"] will be in the format "[start, end]"
                timestamps = new Set();
                for (var i = 0; i < json["timeblocks"].length; i++) {
                    var startTimestamp = parseInt(data["timeblocks"][0]);
                    var endTimestamp = parseInt(data["timeblocks"][1]);

                    while (startTimestamp < endTimestamp) {
                        timestamps.add(startTimestamp.toString());
                        // add one slot of seconds
                        startTimestamp += tc.slotIncrement * 60;
                    }
                }
                localTimestamps = timestamps;*/
            })
            .fail(function (xhr, status, errorThrown) {
                $loadingSpinner.hide();
                $loadingError.show();
            });

        createTable();
    }

    function createTable() {
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
                "class": "day-cell"
            });
            $tcRow.append($dayCell);

            // Highlight current day
            if (dayTime.isSame(tc.initialDate, "day")) {
                $dayCell.css("background-color", "#f4f4f4");
            }

            var $dayStack = $("<div>", {
                "class": "slot-stack",
                "id": "tcDay" + i,
                "data-day": i
            });
            $dayCell.append($dayStack);

            for (j = 0; j < slotTimes.length; j++) {
                var slotTime = slotTimes[j];
                var newTime = moment(dayTime).hour(slotTime.hour()).minute(slotTime.minute()).second(0);

                var $newSlot = $("<div>", {
                    "id": i + "-" + newTime.format("HH:mm"),
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


    return tc;
})();