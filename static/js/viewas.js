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

    var selectedSegments = [];

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
                }
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
                showAlert("danger", "Error", "Failed to load hours (" + error + ")");
            })
            .always(function () {
                createTable();
            });
    }

    function createTable() {
        var $oldTcHeader = $("#tcHeader");
        var $newTcHeader = $("<thead>", {
            "id": "tcHeader"
        });

        var $headerRow = $("<tr>").append($("<th>")).appendTo($newTcHeader);
        $oldTcHeader.replaceWith($newTcHeader);

        var $oldTcBody = $("#tcBody");
        var $newTcBody = $("<tbody>", {
            "id": "tcBody"
        });

        var bodyRow = $("<tr>");
        $newTcBody.append(bodyRow);

        for (var i = -1; i < tc.periodDuration; i++) {
            var $dayStack = $("<div>").addClass("slot-stack");
            bodyRow.append($("<td>").append($dayStack));

            // Highlight current day
            if (moment(periodStart).add(i, "day").isSame(tc.initialDate, "day")) {
                $dayStack.css("background-color", "#fafafa");
            }

            var dayStart = moment(periodStart).add(i, "day").hour(tc.slotFirstStart.hour()).minute(tc.slotFirstStart.minute()).second(0);
            var dayEnd = moment(periodStart).add(i, "day").hour(tc.slotLastStart.hour()).minute(tc.slotLastStart.minute()).second(0);

            if (i == -1) {
                // First column is hour marks
                var slotStart = moment(dayStart);
                var slotEnd = moment(dayEnd).endOf("hour");

                if (!slotStart.isBefore(slotEnd)) {
                    console.error("Invalid day start and end");
                    return;
                }

                while (slotStart.isBefore(slotEnd)) {
                    if (slotStart.minute() == 0) {
                        $dayStack.append($("<div>", {
                            "class": "text-muted hour-mark",
                            "html": slotStart.format("ha")
                        }));
                    }
                    slotStart.add(tc.slotIncrement, "minute");
                }

            } else {
                var slotStart = moment(periodStart).add(i, "day").hour(tc.slotFirstStart.hour()).startOf("hour");
                var slotEnd = moment(periodStart).add(i, "day").hour(tc.slotLastStart.hour()).endOf("hour");

                if (!slotStart.isBefore(dayEnd)) {
                    console.error("Invalid day start and end");
                    return;
                }

                var $segmentStart;
                var dayHours = 0.0;

                while (slotStart.isBefore(slotEnd)) {

                    var $newSlot = $("<div>")
                        .attr("id", i + "-" + slotStart.format("HH-mm"))
                        .addClass("slot locked")
                        .data("start_ts", slotStart.unix().toString())
                        .data("end_ts", moment(slotStart).add(tc.slotIncrement - 1, "minute").endOf("minute").unix().toString());

                    if (slotStart.isBefore(dayStart)) {
                        // Lock if before start of day
                        $newSlot.addClass("locked");
                    } else if (slotStart.isAfter(dayEnd)) {
                        // Lock if after end of day
                        $newSlot.addClass("locked");
                    } else {
                        //for (var j = 0; j < selectedSegments.length; j++) {
                        $.each(selectedSegments, function (index, segment) {
                            // if this slot intersects the segment
                            if (segment["start_timestamp"] <= $newSlot.data("end_ts") && segment["end_timestamp"] >= $newSlot.data("start_ts")) {
                                dayHours += tc.slotIncrement / 60

                                $newSlot.addClass("selected locked");

                                // Slot is considered start if it contains the segment start
                                var segmentStart = segment["start_timestamp"] >= $newSlot.data("start_ts") && segment["start_timestamp"] <= $newSlot.data("end_ts");
                                // Slot is considered end if it contains the segment end
                                var segmentEnd = segment["end_timestamp"] >= $newSlot.data("start_ts") && segment["end_timestamp"] <= $newSlot.data("end_ts");

                                if (segmentStart) {
                                    $segmentStart = $newSlot;
                                    $segmentStart.css("border-top-left-radius", "4px");
                                    $segmentStart.css("border-top-right-radius", "4px");
                                }

                                if (segmentEnd) {
                                    $newSlot.css("border-bottom-left-radius", "4px");
                                    $newSlot.css("border-bottom-right-radius", "4px");

                                    if (!segmentStart) {
                                        var startTime = moment.unix(segment["start_timestamp"]);
                                        var endTime = moment.unix(segment["end_timestamp"]).add(1, "minute");

                                        var startPrefix = "";
                                        var endPrefix = "";

                                        // The start slot is split, prefix warning symbol
                                        if (segment["start_timestamp"] != $segmentStart.data("start_ts")) {
                                            startPrefix = "&#9888;";
                                        }

                                        // The end slot is split, prefix warning symbol
                                        if (segment["end_timestamp"] != $newSlot.data("end_ts")) {
                                            endPrefix = "&#9888;";
                                        }

                                        if (startTime.format("a") === endTime.format("a")) {
                                            $("<div>").addClass("segment-label").html(startPrefix + startTime.format("h:mm") + "–" + endPrefix + endTime.format("h:mma")).appendTo($segmentStart);
                                        } else {
                                            $("<div>").addClass("segment-label").html(startPrefix + startTime.format("h:mma") + "–" + endPrefix + endTime.format("h:mma")).appendTo($segmentStart);
                                        }
                                    }
                                }

                                // Don't need to continue searching segments, break loop
                                return false;
                            }
                        });
                    }

                    $dayStack.append($newSlot);
                    slotStart.add(tc.slotIncrement, "minute");
                }

                var $headerCell = $("<th>").addClass("text-center").appendTo($headerRow);
                $("<div>").text(slotStart.format("ddd")).appendTo($headerCell);
                $("<div>").text(slotStart.format("MMM D")).appendTo($headerCell);
                $("<div>").css("font-weight", "normal").text(dayHours.toFixed(1) + " hours").appendTo($headerCell);
            }
        }

        $oldTcBody.replaceWith($newTcBody);
    }

    function showAlert(type, title, content) {
        // success, info, warning, danger
        var $newAlert = $("<div>").addClass("alert alert-dismissible fade show").attr("role", "alert")

        $("#alertBanner").empty();
        if (type == "success") {
            $newAlert.addClass("alert-success").append($("<i>").addClass("fa fa-check-circle mr-2"));

        } else if (type == "warning") {
            $newAlert.addClass("alert-warning").append($("<i>").addClass("fa fa-exclamation-triangle mr-2"));

        } else if (type == "danger") {
            $newAlert.addClass("alert-danger").append($("<i>").addClass("fa fa-exclamation-triangle mr-2"));

        } else {
            $newAlert.addClass("alert-info").append($("<i>").addClass("fa fa-info-circle mr-2"));
        }

        $newAlert.append("<strong>" + title + "</strong> " + content).append($("<button>").attr("type", "button").addClass("close").attr("data-dismiss", "alert").html("&times;")).appendTo($("#alertBanner"));
    }

    return tc;
})();
