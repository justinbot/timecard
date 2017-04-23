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

    // 0: no selection, 1: add, 2: delete
    var selectionMode = 0;
    var selectionModes = ["", "selecting", "unselecting"];
    var selectionStart;
    var selectionEnd;

    var selectedSegments = [];

    // Changes should only take place within currently viewed period
    // On changing period, changes should be auto-saved
    // Hour blocks, 2-value arrays of [start timestamp, end timestamp]
    //var timestamps; // set of timestamps as pulled from the server
    //var localTimestamps; // set of timestamps as changed locally

    /* public variables */
    tc.userId;
    tc.initialDate;
    tc.initialPeriodStart;
    tc.periodDuration;
    tc.slotIncrement;
    tc.slotFirstStart;
    tc.slotLastStart;
    tc.lockDate;

    tc.init = function () {
        currentPeriod();
    }

    function onPeriodChanged() {
        loadTimeSegments();

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
        periodStart = moment(tc.initialPeriodStart);
        periodEnd = moment(periodStart).add(tc.periodDuration - 1, "day").endOf("day");

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

    function loadTimeSegments() {
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
            .done(function (data, status, xhr) {
                $loadingSpinner.hide();
                $loadingCheck.show();

                // User "modified" is in UTC, convert to local for display
                $("#tcStatus").text("Last modified " + moment.utc(data["modified"]).local().fromNow());

                selectedSegments = data["time_segments"];
            })
            .fail(function (xhr, status, error) {
                $loadingSpinner.hide();
                $loadingError.show();

                // TODO: Display error on failure to load timestamps
            })
            .always(function () {
                createTable();
            });
    }

    function addTimeSegment(start, end) {
        console.log("Adding time segment: " + start + " - " + end);

        $.ajax({
                "method": "POST",
                "url": "/api/users/" + tc.userId + "/hours",
                "data": JSON.stringify({
                    "delete": false,
                    "start": start,
                    "end": end
                }),
                "contentType": "application/json; charset=utf-8",
                "dataType": "json"
            })
            .done(function (data, status, xhr) {
                // TODO: 
            })
            .fail(function (xhr, status, error) {
                // TODO: Display alert with error
            }).always(function () {
                loadTimeSegments();
            });
    }

    function deleteTimeSegment(start, end) {
        console.log("Deleting time segment: " + start + " - " + end);

        $.ajax({
                "method": "POST",
                "url": "/api/users/" + tc.userId + "/hours",
                "data": JSON.stringify({
                    "delete": true,
                    "start": start,
                    "end": end
                }),
                "contentType": "application/json; charset=utf-8",
                "dataType": "json"
            })
            .done(function (data, status, xhr) {
                // TODO: 
            })
            .fail(function (xhr, status, error) {
                // TODO: Display alert with error
            }).always(function () {
                loadTimeSegments();
            });
    }

    function createTable() {
        var $oldTcHeader = $("#tcHeader");
        var $newTcHeader = $("<thead>", {
            "id": "tcHeader"
        });

        var headerRow = $("<tr>");
        $newTcHeader.append(headerRow);
        headerRow.append($("<th>"));
        for (var i = 0; i < tc.periodDuration; i++) {
            var headerDate = moment(periodStart).add(i, "day");
            headerCell = $("<th>", {
                "class": "text-center"
            });
            headerRow.append(headerCell);
            headerCell.append($("<div>", {
                "html": headerDate.format("ddd")
            }));
            headerCell.append($("<div>", {
                "html": headerDate.format("MMM D")
            }));
            headerCell.append($("<div>", {
                "html": "0.0"
            }));
        }

        $oldTcHeader.replaceWith($newTcHeader);

        var $oldTcBody = $("#tcBody");
        var $newTcBody = $("<tbody>", {
            "id": "tcBody"
        });

        var bodyRow = $("<tr>");
        $newTcBody.append(bodyRow);

        for (var i = -1; i < tc.periodDuration; i++) {
            var $dayStack = $("<div>").addClass("slot-stack").on({
                "mouseleave": function () {
                    // End current selection on leave column
                    endSelection();
                }
            });

            bodyRow.append($("<td>").append($dayStack));

            // Highlight current day
            if (moment(periodStart).add(i, "day").isSame(tc.initialDate, "day")) {
                $dayStack.css("background-color", "#fafafa");
            }

            if (i == -1) {
                // First column is hour marks
                var slotStart = moment(tc.slotFirstStart).minute(0);
                var dayEnd = moment(tc.slotLastStart);

                if (!slotStart.isBefore(dayEnd)) {
                    console.error("Invalid day start and end");
                    return;
                }

                while (slotStart.isBefore(dayEnd)) {
                    if (slotStart.minute() == 0) {
                        $dayStack.append($("<div>", {
                            "class": "text-muted hour-mark",
                            "html": slotStart.format("ha")
                        }));
                    }
                    slotStart.add(tc.slotIncrement, "minute");
                }

            } else {
                var slotStart = moment(periodStart).add(i, "day").hour(tc.slotFirstStart.hour()).minute(0).second(0);
                var dayEnd = moment(periodStart).add(i, "day").hour(tc.slotLastStart.hour()).minute(tc.slotLastStart.minute()).second(0);

                if (!slotStart.isBefore(dayEnd)) {
                    console.error("Invalid day start and end");
                    return;
                }

                var $segmentStart;
                while (slotStart.isBefore(dayEnd)) {
                    var $newSlot = $("<div>")
                        .addClass("slot")
                        .data("start_ts", slotStart.unix().toString())
                        .data("end_ts", moment(slotStart).add(tc.slotIncrement - 1, "minute").endOf("minute").unix().toString())
                        .on({
                            "mousedown": function () {
                                // Starting segment selection
                                startSelection($(this));
                            },
                            "mouseup": function () {
                                // End segment selection
                                endSelection();
                            },
                            "mouseover": function () {
                                // Select this slot (if selecting)
                                if (selectionMode != 0) {
                                    selectionEnd = $(this);
                                    updateSelection();
                                }
                            }
                        });

                    for (var j = 0; j < selectedSegments.length; j++) {
                        var segment = selectedSegments[j];

                        if ($newSlot.data("start_ts") >= segment["start_timestamp"] && $newSlot.data("start_ts") <= segment["end_timestamp"]) {
                            $newSlot.addClass("selected");
                            if ($newSlot.data("start_ts") == segment["start_timestamp"]) {
                                $segmentStart = $newSlot;
                            } else if ($newSlot.data("end_ts") == segment["end_timestamp"]) {
                                // end slot
                                var startTime = moment.unix(segment["start_timestamp"]);
                                var endTime = moment.unix(segment["end_timestamp"]).add(1, "minute");

                                if (startTime.format("a") === endTime.format("a")) {
                                    $("<div>").addClass("segment-label").text(startTime.format("h:mm") + "–" + endTime.format("h:mma")).appendTo($segmentStart);
                                } else {
                                    $("<div>").addClass("segment-label").text(startTime.format("h:mma") + "–" + endTime.format("h:mma")).appendTo($segmentStart);
                                }
                            }
                            break;
                        }
                    }

                    $dayStack.append($newSlot);
                    slotStart.add(tc.slotIncrement, "minute");
                }
            }
        }

        /*var startTime = moment(tc.slotFirstStart).startOf("hour");
        var endTime = moment(tc.slotLastStart).endOf("hour");
        while (startTime.isBefore(endTime)) {
            startTime.add(tc.slotIncrement, "minute");
        }*/

        // Add hour marks in first column
        /*for (var i = 0; i < slotTimes.length; i++) {
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
            bodyRow.append($dayCell);

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
                $newSlot.attr("class", "slot");

                $dayStack.append($newSlot);
            }
        }*/

        $oldTcBody.replaceWith($newTcBody);
    }

    function startSelection(slot) {
        //endSelection();

        selectionStart = slot;
        selectionEnd = slot;

        if (slot.hasClass("selected")) {
            // Unselecting slots
            selectionMode = 2;
        } else {
            // Selecting slots
            selectionMode = 1;
        }

        updateSelection(slot);
    }

    function updateSelection(slot) {

        selectionStart.parent().children().removeClass("selecting unselecting");
        var mode = selectionModes[selectionMode];

        selectionStart.addClass(mode);
        if (!selectionStart.is(selectionEnd)) {
            if (selectionStart.data("start_ts") <= selectionEnd.data("start_ts")) {
                selectionStart.nextUntil(selectionEnd).addClass(mode);
            } else {
                selectionStart.prevUntil(selectionEnd).addClass(mode);
            }
            selectionEnd.addClass(mode);
        }
    }

    function endSelection() {
        if (selectionMode != 0) {
            // Make sure timestamps are in correct order
            if (selectionStart.data("start_ts") <= selectionEnd.data("start_ts")) {
                if (selectionMode == 1) {
                    addTimeSegment(selectionStart.data("start_ts"), selectionEnd.data("end_ts"));
                } else if (selectionMode == 2) {
                    deleteTimeSegment(selectionStart.data("start_ts"), selectionEnd.data("end_ts"));
                }
            } else {
                if (selectionMode == 1) {
                    addTimeSegment(selectionEnd.data("start_ts"), selectionStart.data("end_ts"));
                } else if (selectionMode == 2) {
                    deleteTimeSegment(selectionEnd.data("start_ts"), selectionStart.data("end_ts"));
                }
            }

            selectionMode = 0;
            selectionStart = null;
            selectionEnd = null;
        }
    }

    return tc;
})();