var TcUser = (function () {
    var tc = {};

    /* DOM elements */
    var periodNavToday;
    var periodRange;

    var tcTable,
        tcHead,
        tcHeaders = [],
        tcDays = [];

    /* local variables */
    var focusDate;
    var periodStart,
        periodEnd;

    var selectedTimestamps = new Set();

    /* public variables */
    tc.initialDate;
    tc.validPeriodStart;
    tc.periodDuration;
    tc.lockDate;
    tc.slotIncrement;
    tc.slotFirstStart;
    tc.slotLastStart;

    tc.init = function () {
        periodNavToday = document.getElementById("periodNavToday");
        periodRange = document.getElementById("periodRange");

        tcTable = document.getElementById("tcTable");
        tcHead = document.getElementById("tcHead");

        for (var i = 0; i < tc.periodDuration; i++) {
            tcHeaders.push(document.getElementById("tcHeader" + i));
        }

        tc.currentPeriod();
    }

    function onTimestampsChanged() {
        updateTable();

        for (var i = 0; i < tcHeaders.length; i++) {
            updateHeaderHours(i);
        }

        for (var i = 0; i < tc.periodDuration; i++) {
            updateDayBlocks(document.getElementById("tcDay" + i));
        }
    }

    function onPeriodChanged() {
        dbUpdate();
        updateHeaderDates();
        updatePeriod();
    }

    function updateHeaderDates() {
        for (var i = 0; i < tcHeaders.length; i++) {
            var header = tcHeaders[i];
            var headerDate = moment(periodStart).add(i, "day");
            header.dataset.start = headerDate.unix();
            header.dataset.end = moment(headerDate).endOf("day").unix();
            header.children[0].textContent = headerDate.format("dddd");
            header.children[1].textContent = headerDate.format("MMM D");
        }
    }

    function updateHeaderHours(d) {
        var header = tcHeaders[d];
        var hours = 0.0;
        for (let elem of selectedTimestamps) {
            if (elem >= header.dataset.start && elem <= header.dataset.end) {
                hours += (tc.slotIncrement / 60);
            }
        }

        header.children[2].textContent = hours.toFixed(1) + " hours";
    }

    function updateDayBlocks(day) {
        var blockStartTime;
        var blockLabel;
        for (var i = 0; i < day.children.length; i++) {
            var slot = day.children[i];
            slot.style.borderBottom = "";
            slot.textContent = "";

            var slotSelected = selectedTimestamps.has(slot.dataset.timestamp);
            var prevSlotSelected = i > 0 && selectedTimestamps.has(day.children[i - 1].dataset.timestamp);

            var blockStart = slotSelected && (i == 0 || !prevSlotSelected);
            var blockEnd = (!slotSelected && prevSlotSelected) || (slotSelected && i == day.children.length - 1);

            if (blockStart) {
                if (i > 0) {
                    day.children[i - 1].style.borderBottom = "1px solid #526faa";
                }

                blockStartTime = moment.unix(slot.dataset.timestamp);
                blocklabel = document.createElement("div");
                blocklabel.setAttribute("class", "blocklabel");
                blocklabel.textContent = "...";
                slot.appendChild(blocklabel);
            }

            if (blockEnd) {
                var blockEndTime = moment.unix(slot.dataset.timestamp);
                if (i == day.children.length - 1) {
                    blockEndTime.add(tc.slotIncrement, "minute");
                }
                // If start and end are same meridiem
                if (blockStartTime.format("a") === blockEndTime.format("a")) {
                    blocklabel.textContent = blockStartTime.format("h:mm") + "–" + blockEndTime.format("h:mma");
                } else {
                    blocklabel.textContent = blockStartTime.format("h:mma") + "–" + blockEndTime.format("h:mma");
                }
            }
        }
    }

    function updateTable() {
        var oldTcBody = tcTable.getElementsByTagName("tbody")[0];
        var newTcBody = document.createElement("tbody");

        var tcRow = newTcBody.insertRow();

        var slotTimes = [];
        var slotTime = moment(tc.slotFirstStart).startOf("hour");
        var endTime = moment(tc.slotLastStart).endOf("hour");
        while (slotTime.isBefore(endTime)) {
            slotTimes.push(moment(slotTime));
            slotTime.add(tc.slotIncrement, "minute");
        }

        console.log(slotTimes);

        var hoursCell = tcRow.insertCell();
        var hoursStack = document.createElement("div");
        hoursStack.setAttribute("class", "slotstack");

        for (i = 0; i < slotTimes.length; i++) {
            if (slotTimes[i].minute() == 0) {
                var hourMark = document.createElement("div");
                hourMark.setAttribute("class", "hourmark");
                hourMark.textContent = slotTimes[i].format("ha");
                hoursStack.appendChild(hourMark);
            }
        }
        hoursCell.appendChild(hoursStack);

        for (i = 0; i < tc.periodDuration; i++) {
            var dayTime = moment(periodStart).add(i, "day");

            var dayCell = tcRow.insertCell();
            // Highlight current day
            if (dayTime.isSame(tc.initialDate, "day")) {
                dayCell.style.background = "#f1f2f4";
            }

            var dayStack = document.createElement("div");
            dayStack.id = "tcDay" + i;
            dayStack.setAttribute("class", "slotstack");
            dayStack.dataset.day = i;
            dayCell.appendChild(dayStack);

            for (j = 0; j < slotTimes.length; j++) {
                var slotTime = slotTimes[j];
                var newSlot = document.createElement("div");
                var newTime = moment(dayTime).hour(slotTime.hour()).minute(slotTime.minute()).second(0);
                newSlot.dataset.timestamp = newTime.unix();

                if (selectedTimestamps.has(newSlot.dataset.timestamp)) {
                    newSlot.setAttribute("class", "slot-selected locked");
                } else {
                    newSlot.setAttribute("class", "slot locked");
                }

                dayStack.appendChild(newSlot);
            }
        }

        tcTable.replaceChild(newTcBody, oldTcBody);
    }

    function updatePeriod() {
        periodNavToday.disabled = focusDate.isSame(tc.initialDate, "day");

        var startDate = moment(periodStart);
        var endDate = moment(periodEnd);
        if (startDate.isSame(endDate, "year")) {
            if (startDate.isSame(endDate, "month")) {
                periodRange.textContent = startDate.format("MMM D") + "–" + endDate.format("D, YYYY");
            } else {
                periodRange.textContent = startDate.format("MMM D") + "–" + endDate.format("MMM D, YYYY");
            }
        } else {
            periodRange.textContent = startDate.format("MMM D, YYYY") + "–" + endDate.format("MMM D, YYYY");
        }
    }

    function dbUpdate() {
        var updateDict = {
            "range": [moment(periodStart).startOf("day").unix(), moment(periodEnd).endOf("day").unix()]
        };

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/update", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            dbUpdateOnload(xhr.status, xhr.response);
        }
        xhr.send(JSON.stringify(updateDict));
    }

    function dbUpdateOnload(status, response) {
        if (status == 200) {
            lastModified = moment(response["lastmodified"]);

            selectedTimestamps = new Set();
            for (var i = 0; i < response["selected"].length; i++) {
                selectedTimestamps.add(response["selected"][i]);
            }
            onTimestampsChanged();
        } else {
            // TODO: Display error regarding status
        }
    }

    tc.currentPeriod = function () {
        focusDate = moment(tc.initialDate);
        periodStart = moment(tc.validPeriodStart);
        // Calculate start of the period the initialDate is in
        periodStart.add(Math.floor((focusDate.unix() - periodStart.unix()) / 60 / 60 / 24 / tc.periodDuration) * tc.periodDuration, "day");
        periodEnd = moment(periodStart).add(tc.periodDuration - 1, "day").endOf("day");

        onPeriodChanged();
    }

    tc.prevPeriod = function () {
        focusDate.subtract(tc.periodDuration, "day");
        periodStart.subtract(tc.periodDuration, "day");
        periodEnd.subtract(tc.periodDuration, "day");

        onPeriodChanged();
    }

    tc.nextPeriod = function () {
        focusDate.add(tc.periodDuration, "day");
        periodStart.add(tc.periodDuration, "day");
        periodEnd.add(tc.periodDuration, "day");

        onPeriodChanged();
    }

    return tc;
})();
// Justin Carlson