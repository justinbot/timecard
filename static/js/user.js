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

    var selectionMode = 0; // 0: no selection, 1: add, 2: delete
    var selectionModes = ["", "selecting", "unselecting"];
    var selectionStart;
    var selectionEnd;

    var selectedSegments = [];
    var templates = {};
    //var activeTemplate = "";

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
        activeTemplate = "None";

        focusDate.subtract(tc.periodDuration, "day");
        periodStart.subtract(tc.periodDuration, "day");
        periodEnd.subtract(tc.periodDuration, "day");

        onPeriodChanged();
    }

    function currentPeriod() {
        activeTemplate = "None";

        focusDate = moment(tc.initialDate);
        periodStart = moment(tc.initialPeriodStart);
        periodEnd = moment(periodStart).add(tc.periodDuration - 1, "day").endOf("day");

        onPeriodChanged();
    }

    function nextPeriod() {
        activeTemplate = "None";

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

                console.log(data);

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

        loadTemplates();
    }

    function addTimeSegment(start, end) {
        //console.log("Adding time segment: " + start + " - " + end);

        $.ajax({
                "method": "POST",
                "url": "/api/users/" + tc.userId + "/hours",
                "data": JSON.stringify({
                    "delete": false,
                    "start": start,
                    "end": end
                }),
                "contentType": "application/json; charset=utf-8"
            })
            .done(function (data, status, xhr) {
                // TODO: 
            })
            .fail(function (xhr, status, error) {
                showAlert("danger", "Error", "Failed to save changes (" + error + ")");
            })
            .always(function () {
                loadTimeSegments();
            });
    }

    function deleteTimeSegment(start, end) {
        //console.log("Deleting time segment: " + start + " - " + end);

        $.ajax({
                "method": "POST",
                "url": "/api/users/" + tc.userId + "/hours",
                "data": JSON.stringify({
                    "delete": true,
                    "start": start,
                    "end": end
                }),
                "contentType": "application/json; charset=utf-8"
            })
            .done(function (data, status, xhr) {
                // TODO: 
            })
            .fail(function (xhr, status, error) {
                showAlert("danger", "Error", "Failed to save changes (" + error + ")");
            })
            .always(function () {
                loadTimeSegments();
            });
    }

    function createTable() {
        var $oldTcHeader = $("#tcHeader");
        var $newTcHeader = $("<thead>", {
            "id": "tcHeader"
        });

        var $headerRow = $("<tr>").appendTo($newTcHeader);
        $("<th>").appendTo($headerRow);

        /*for (var i = 0; i < tc.periodDuration; i++) {
            var headerDate = moment(periodStart).add(i, "day");
            
            var $headerCell = $("<th>").addClass("text-center").appendTo($headerRow);
            $("<div>").text(headerDate.format("ddd")).appendTo($headerCell);
            $("<div>").text(headerDate.format("MMM D")).appendTo($headerCell);
            $("<div>").css("font-weight", "normal").text("0.0 hours").appendTo($headerCell);
        }*/

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

                                $newSlot.addClass("selected");

                                // Slot is considered start if it contains the segment start
                                var segmentStart = segment["start_timestamp"] >= $newSlot.data("start_ts") && segment["start_timestamp"] <= $newSlot.data("end_ts");
                                // Slot is considered end if it contains the segment end
                                var segmentEnd = segment["end_timestamp"] >= $newSlot.data("start_ts") && segment["end_timestamp"] <= $newSlot.data("end_ts");

                                if (segmentStart) {
                                    /*if (segment["start_timestamp"] != $newSlot.data("start_ts")) {
                                        // Slot is split by this segment
                                        $("<i>").addClass("fa fa-exclamation-circle").css("position", "absolute").appendTo($newSlot);
                                    }*/
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

    function loadTemplates() {
        $.ajax({
                "method": "GET",
                "url": "/api/users/" + tc.userId + "/templates"
            })
            .done(function (data, status, xhr) {
                console.log(data);

                templates = data["templates"];
            })
            .fail(function (xhr, status, error) {
                showAlert("danger", "Error", "Failed to load templates (" + error + ")");
            })
            .always(function () {
                hideNewTemplate();
                var $menuSelectTemplate = $("#menuSelectTemplate");
                $menuSelectTemplate.empty();

                $("<button>").attr("type", "button").addClass("dropdown-item").text("None").data("id", -1).appendTo($menuSelectTemplate);
                $("<div>").addClass("dropdown-divider").appendTo($menuSelectTemplate);

                $.each(templates, function (id, value) {
                    $("<button>").attr("type", "button").addClass("dropdown-item d-flex justify-content-between").text(value["name"]).data("id", id)
                        .append($("<button>").attr("type", "button").addClass("close text-danger").data("id", id).html("<span>&times;</span>")).appendTo($menuSelectTemplate);
                });

                //updateActiveTemplate();

                //activeTemplate = "None";
                $("#buttonSelectTemplate").text(activeTemplate);
            });
    }

    function addTemplate(name, segments) {
        $.ajax({
                "method": "POST",
                "url": "/api/users/" + tc.userId + "/templates",
                "data": JSON.stringify({
                    "name": name,
                    "segments": segments
                }),
                "contentType": "application/json; charset=utf-8"
            })
            .done(function (data, status, xhr) {
                showAlert("success", "", "Successfully saved template " + name);
            })
            .fail(function (xhr, status, error) {
                showAlert("danger", "Error", "Failed to save template (" + error + ")");
            })
            .always(function () {
                loadTemplates();
            });
    }

    function deleteTemplate(id) {
        $.ajax({
                "method": "DELETE",
                "url": "/api/users/" + tc.userId + "/templates/" + id
            })
            .done(function (data, status, xhr) {
                showAlert("success", "", "Successfully deleted template " + templates[id]["name"]);
            })
            .fail(function (xhr, status, error) {
                showAlert("danger", "Error", "Failed to delete template (" + error + ")");
            })
            .always(function () {
                loadTemplates();
            });
    }

    $("#buttonNewTemplate").click(function () {
        showNewTemplate();
    });

    $("#buttonCancelTemplate").click(function () {
        hideNewTemplate();
    });

    $("#buttonSaveTemplate").click(function () {
        var segments = [];
        $.each(selectedSegments, function (index, segment) {
            var day = segment["start_timestamp"] - periodStart.unix();
            segments.push([segment["start_timestamp"] - periodStart.unix(), segment["end_timestamp"] - periodStart.unix()]);
        });

        addTemplate($("#inputTemplateName").val(), segments);
    });

    $("#inputTemplateName").on("change paste keyup", function () {
        $("#buttonSaveTemplate").prop("disabled", $("#inputTemplateName").val().length < 3 || selectedSegments.length == 0);
    });

    $("#menuSelectTemplate").on("click", ".dropdown-item", function () {
        var id = $(this).data("id");

        if (id != -1) {
            applyTemplate(id);
        } else {
            //updateActiveTemplate();
            activeTemplate = "None";
            $("#buttonSelectTemplate").text(activeTemplate);
        }
    });

    $("#menuSelectTemplate").on("click", ".close", function (event) {
        // Stop click from also selecting this template
        event.stopPropagation();

        var id = $(this).data("id");

        deleteTemplate(id);
    });

    function showNewTemplate() {
        $("#buttonNewTemplate").hide();
        $("#dropdownSelectTemplate").hide();
        $("#inputTemplateName").show();
        $("#inputTemplateName").focus();
        $("#buttonCancelTemplate").show();
        $("#buttonSaveTemplate").prop("disabled", true);
        $("#buttonSaveTemplate").show();
    }

    function hideNewTemplate() {
        $("#buttonNewTemplate").show();
        $("#dropdownSelectTemplate").show();
        $("#inputTemplateName").hide();
        $("#inputTemplateName").val("");
        $("#buttonCancelTemplate").hide();
        $("#buttonSaveTemplate").hide();
    }

    function applyTemplate(id) {
        if (id == -1) {
            return;
        }

        console.log("applying template");

        var template = templates[id];
        activeTemplate = template["name"];

        // Delete all segments in period, add segments in template, load again
        $.ajax({
                "method": "POST",
                "url": "/api/users/" + tc.userId + "/hours",
                "data": JSON.stringify({
                    "delete": true,
                    "start": periodStart.unix(),
                    "end": periodEnd.unix()
                }),
                "contentType": "application/json; charset=utf-8"
            })
            .done(function (data, status, xhr) {
                $.each(template["segments"], function (index, segment) {
                    console.log("applying segment");
                    $.ajax({
                            "method": "POST",
                            "url": "/api/users/" + tc.userId + "/hours",
                            "data": JSON.stringify({
                                "delete": false,
                                "start": periodStart.unix() + segment["start_time"],
                                "end": periodStart.unix() + segment["end_time"]
                            }),
                            "contentType": "application/json; charset=utf-8"
                        })
                        .done(function (data, status, xhr) {
                            // TODO: 
                        })
                        .fail(function (xhr, status, error) {
                            //showAlert("danger", "Error", "Failed to apply template (" + error + ")");
                            //freturn false;
                        })
                        .always(function () {
                            // Load after last segment is added
                            if (index == template["segments"].length - 1) {
                                showAlert("success", "", "Successfully applied template " + template["name"]);
                                loadTimeSegments();
                            }
                        });
                });
            })
            .fail(function (xhr, status, error) {
                showAlert("danger", "Error", "Failed to apply template (" + error + ")");
            })
            .always(function () {
                //loadTimeSegments();
            });
    }

    /*function updateActiveTemplate() {
        var segments = [];
        var activeTemplate = "None";

        $.each(selectedSegments, function (index, segment) {
            var day = segment["start_timestamp"] - periodStart.unix();
            segments.push([segment["start_timestamp"] - periodStart.unix(), segment["end_timestamp"] - periodStart.unix()]);
        });
        
        console.log(segments);

        $.each(templates, function (id, value) {
            var isTemplate = true;
            var templateSegments = templates[id]["segments"];
            console.log(templateSegments);
            $.each(segments, function (index, segment) {
                if ($.inArray(templateSegments, segment) === -1) {
                    isTemplate = false;
                    console.log("not template");
                    return false;
                }
            });
            if (isTemplate) {
                console.log("found template");
                activeTemplate = templates[id]["name"];
                return false;
            }
        });

        $("#buttonSelectTemplate").text(activeTemplate);
    }*/

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
