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

    var localSelectedTimestamps = new Set();
    var localUnselectedTimestamps = new Set();
    var selectedTimestamps = new Set();

    //var dragTimestamps;

    var slotDown;
    var slotToggleTo;

    var templSelect;
    var templNewButton;
    var templNewForm;
    var templNewTextInput;
    var templDropdown;
    /*var tcNavToday;
    var tcNavRange;
    var tcNavTotal;

    var templSelectForm;
    var templSelect;
    var templNew;
    var templEditForm;
    var templEditTextInput;
    var templEditSave;
    var templEditDelete;

    var dbStatus;
    var dbSave;

    var tcDays = [];*/

    /* local variables */
    /*var currentTemplate = ""; // store template associated with each day? or just have a template if set

    var localSelectedTimestamps = new Set();
    var localUnselectedTimestamps = new Set();
    var selectedTimestamps = new Set();
    var focusDate;
    var periodStart;
    var lastModified;

    var changesMade = false;
    var locked = false;
    var dayHours = [];
    var totalHours = 0.0;

    var slotDown = false;
    var slotToggleTo = true;*/

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
        templSelect = document.getElementById("templSelect");
        templNewButton = document.getElementById("templNewButton");
        templNewForm = document.getElementById("templNewForm");
        templNewTextInput = document.getElementById("templNewTextInput");
        templSelect = document.getElementById("templSelect");
        /*templSelectForm = document.getElementById("templ-select-form");
                templSelect = document.getElementById("templ-select");
                templNew = document.getElementById("templ-new");
                templEditForm = document.getElementById("templ-edit-form");
                templEditTextInput = document.getElementById("templ-edit-textinput");
                templEditSave = document.getElementById("templ-edit-save");
                templEditDelete = document.getElementById("templ-edit-delete");

                dbStatus = document.getElementById("db-status");
                dbSave = document.getElementById("database-save");

                tc.hideTemplEdit();*/

        tcTable = document.getElementById("tcTable");
        tcHead = document.getElementById("tcHead");

        for (var i = 0; i < tc.periodDuration; i++) {
            tcHeaders.push(document.getElementById("tcHeader" + i));
        }

        tc.currentPeriod();
        tc.updateTemplates();
    }

    function onTimestampsChanged() {
        // Update day hour totals and cell selected statuses
        updateTable();
    }

    function onLocalTimestampsChanged() {}

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
            header.children[0].textContent = headerDate.format("ddd, MMM D");
        }
    }

    function updateHeaderHours(d) {
        var header = tcHeaders[d];
        var hours = 0.0;
        for (let elem of selectedTimestamps) {
            if (elem >= header.dataset.start && elem <= header.dataset.end) {
                if (!localUnselectedTimestamps.has(elem)) {
                    hours += (tc.slotIncrement / 60);
                }
            }
        }

        for (let elem of localSelectedTimestamps) {
            if (elem >= header.dataset.start && elem <= header.dataset.end) {
                hours += (tc.slotIncrement / 60);
            }
        }

        header.children[1].textContent = hours.toFixed(1) + " hours";
    }

    function updateDayBlocks(day) {
        var blockStartTime;
        var blockLabel;
        for (var i = 0; i < day.children.length; i++) {
            var slot = day.children[i];
            slot.style.borderBottom = "";
            slot.textContent = "";

            var slotSelected = timestampSelected(slot.dataset.timestamp);
            var prevSlotSelected = i > 0 && timestampSelected(day.children[i - 1].dataset.timestamp);

            var blockStart = slotSelected && (i == 0 || !prevSlotSelected);
            var blockEnd = (!slotSelected && prevSlotSelected) || (slotSelected && i == day.children.length - 1);

            if (blockStart) {
                if (i > 0) {
                    day.children[i - 1].style.borderBottom = "1px solid #678fd4";
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
                if (blockStartTime.format("A") === blockEndTime.format("A")) {
                    blocklabel.textContent = blockStartTime.format("h:mm") + "–" + blockEndTime.format("h:mmA");
                } else {
                    blocklabel.textContent = blockStartTime.format("h:mmA") + "–" + blockEndTime.format("h:mmA");
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

        var hoursCell = tcRow.insertCell();
        var hoursStack = document.createElement("div");
        hoursStack.setAttribute("class", "slotstack");
        hoursStack.dataset.day = i;

        for (i = 0; i < slotTimes.length; i++) {
            if (slotTimes[i].minute() == 0) {
                var hourMark = document.createElement("div");
                hourMark.setAttribute("class", "hourmark");
                hourMark.textContent = slotTimes[i].format("hA");
                hoursStack.appendChild(hourMark);
            }
        }
        hoursCell.appendChild(hoursStack);

        for (i = 0; i < tc.periodDuration; i++) {
            var dayTime = moment(periodStart).add(i, "day");

            var dayCell = tcRow.insertCell();
            dayCell.setAttribute("onmouseleave", "TcUser.slotMouseUp()");
            if (dayTime.isSame(tc.initialDate, "day")) {
                dayCell.style.background = "#f8f9fb";
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

                /*
                TODO:
                If period is locked:
                    Set locked selected or unselected class
                Else:
                    Set selected or unselected class, unselected locked if before slot first start
                */

                // Slot is selected if: selected locally, or selected on server and not unselected locally
                if (timestampSelected(newSlot.dataset.timestamp)) {
                    newSlot.setAttribute("class", "slot-selected");
                    newSlot.setAttribute("onmouseover", "TcUser.slotMouseOver(this)");
                    newSlot.setAttribute("onmousedown", "TcUser.slotMouseDown(this)");
                    newSlot.setAttribute("onmouseup", "TcUser.slotMouseUp(this)");
                } else {
                    // if slot time is before first start times, lock it
                    if (slotTime.hour() < tc.slotFirstStart.hour() ||
                        (slotTime.hour() == tc.slotFirstStart.hour() && slotTime.minute() < tc.slotFirstStart.minute())) {
                        newSlot.setAttribute("class", "slot-locked");
                    } else {
                        newSlot.setAttribute("class", "slot");
                        newSlot.setAttribute("onmouseover", "TcUser.slotMouseOver(this)");
                        newSlot.setAttribute("onmousedown", "TcUser.slotMouseDown(this)");
                        newSlot.setAttribute("onmouseup", "TcUser.slotMouseUp(this)");
                    }
                }

                dayStack.appendChild(newSlot);
            }
        }

        tcTable.replaceChild(newTcBody, oldTcBody);

        for (var i = 0; i < tcHeaders.length; i++) {
            updateHeaderHours(i);
        }

        for (var i = 0; i < tc.periodDuration; i++) {
            updateDayBlocks(document.getElementById("tcDay" + i));
        }

        //onLocalTimestampsChanged();
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

    function dbSave() {
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
            dbSaveOnload(xhr.status, xhr.response);
        }
        xhr.send(JSON.stringify(saveDict));

        for (let elem of localSelectedTimestamps) {
            selectedTimestamps.add(elem);
        }

        for (let elem of localUnselectedTimestamps) {
            selectedTimestamps.delete(elem);
        }

        localSelectedTimestamps = new Set();
        localUnselectedTimestamps = new Set();
    }

    function dbSaveOnload(status, response) {
        if (status == 200) {
            // TODO
        } else {
            // TODO: Display error regarding status
        }
    }

    function updateTemplates() {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "/update/template", true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.responseType = "json";
      xhr.onload = function () {
        // Clear list of options
        while (templSelect.firstChild) {
          templSelect.removeChild(templSelect.firstChild);
        }
        // Add new list of options
        templateArray = xhr.response;
        if (templateArray == null)
          return
        for (var i=0; i<templateArray.length; i++) {
          var opt = templateArray[i];
          var ele = document.createElement("option");
          ele.textContent = opt;
          ele.value = opt;
          templSelect.appendChild(ele);
        }
      }
      // Handle no if no templates
      xhr.send();
    }

    function templateSave() {
      var templDict = {};
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "/save/template", true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.responseType = "json";
      xhr.onload = function () {
        // After template is saved, update list of templates
        updateTemplates();
      }
      templDict["name"] = templNewTextInput.value;

      if (templNewTextInput.value == "") {
          // HANDLE IT
          return
      }

      var startTimes = [];
      var endTimes = [];

      var timeDays = document.getElementById("tcTable").getElementsByTagName("tbody")[0].firstChild.childNodes;
      // Length minus 1 due to y-axis labels
      for (i=0; i<timeDays.length-1; i++) {
        var timeDay = document.getElementById("tcDay" + i).childNodes;
        var contig = false;

        var startTimesDay = [];
        var endTimesDay = [];

        for (j=0; j<timeDay.length; j++) {
          if (timeDay[j].getAttribute("class") == "slot-selected") {
            if (contig == false) {
              contig = true;
              startTimesDay.push(timeDay[j].getAttribute("data-timestamp"));
            }
          }
          else {
            if (contig == true) {
              contig = false;
              endTimesDay.push(timeDay[j-1].getAttribute("data-timestamp"));
            }
          }
        }

        // Handle blocks that go to the last hour
        if (contig == true) {
          endTimesDay.push(timeDay[timeDay.length-1].getAttribute("data-timestamp"));
        }
        startTimes.push(startTimesDay);
        endTimes.push(endTimesDay);
      }

      templDict["startTimes"] = startTimes;
      templDict["endTimes"] = endTimes;
      xhr.send(JSON.stringify(templDict));

      tc.newTemplateCancel();
    }

    function templateLoad() {
      var templDict = {};
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "/load/template", true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.responseType = "json";
      xhr.onload = function () {
        templateSetTimeslots(xhr.status, xhr.response);
      }
      var templateName = templSelect.options[templSelect.selectedIndex].value;
      templDict["name"] = templateName;
      templDict["range"] = [periodStart.startOf("day").format("YYYY-MM-DD"), periodEnd.startOf("day").format("YYYY-MM-DD")];
      xhr.send(JSON.stringify(templDict));
    }

    function templateSetTimeslots(status, response) {
      var slots = document.getElementsByClassName('slot-selected');
      for (i=0; i<slots.length; i++) {
        var slot = slots[i];
        slot.setAttribute("class", "slot");
        selectTimestamp(slot.dataset.timestamp);
        updateHeaderHours(slot.parentElement.dataset.day);
        updateDayBlocks(slot.parentElement);
      }

      var offset = moment().utcOffset() * -1;
      for (i=0; i<response.length; i++) {
        var epoch = moment.unix(response[i]).utcOffset(offset)._d.valueOf();
        epoch = epoch/1000;
        var slot = document.querySelectorAll('[data-timestamp="' + epoch + '"]')[0];
        slot.setAttribute("class", "slot-selected");
        selectTimestamp(slot.dataset.timestamp);
        updateHeaderHours(slot.parentElement.dataset.day);
        updateDayBlocks(slot.parentElement);
      }
    }

    tc.save = function () {
        dbSave();
    }

    tc.newTemplate = function () {
      templNewButton.style.display = "none";
      templNewForm.style.display = "";
    }

    tc.newTemplateCancel = function () {
      templNewButton.style.display = "";
      templNewForm.style.display = "none";
      templNewTextInput.value = "";
    }

    tc.saveTemplate = function () {
      templateSave();
    }

    tc.loadTemplate = function () {
      templateLoad();
    }

    tc.updateTemplates = function () {
      updateTemplates();
    }

    tc.slotMouseDown = function (slot) {
        slotDown = true;
        slotToggleTo = !timestampSelected(slot.dataset.timestamp); //(slot.className == "slot");
        tc.slotMouseOver(slot);
    }

    tc.slotMouseOver = function (slot) {
        if (!slotDown) {
            return;
        }
        if (slotToggleTo) {
            // changing slots to selected, only if not already selected
            if (!timestampSelected(slot.dataset.timestamp)) { //(slot.className == "slot") {
                slot.setAttribute("class", "slot-selected");
                selectTimestamp(slot.dataset.timestamp);
                updateHeaderHours(slot.parentElement.dataset.day);
                updateDayBlocks(slot.parentElement);
            }
        } else {
            // changing slots to unselected, only if already selected
            if (timestampSelected(slot.dataset.timestamp)) { //(slot.className == "slot-selected") {
                slot.setAttribute("class", "slot");
                unselectTimestamp(slot.dataset.timestamp);
                updateHeaderHours(slot.parentElement.dataset.day);
                updateDayBlocks(slot.parentElement);
            }
        }
    }

    tc.slotMouseUp = function () {
        slotDown = false;
        // TODO: Apply selected cells
    }

    function selectTimestamp(ts) {
        if (!selectedTimestamps.has(ts)) {
            localSelectedTimestamps.add(ts);
        }
        if (localUnselectedTimestamps.has(ts)) {
            localUnselectedTimestamps.delete(ts);
        }

        onLocalTimestampsChanged();
    }

    function unselectTimestamp(ts) {
        if (selectedTimestamps.has(ts)) {
            localUnselectedTimestamps.add(ts);
        }
        if (localSelectedTimestamps.has(ts)) {
            localSelectedTimestamps.delete(ts);
        }

        onLocalTimestampsChanged();
    }

    function timestampSelected(ts) {
        return (selectedTimestamps.has(ts) && !localUnselectedTimestamps.has(ts)) || localSelectedTimestamps.has(ts);
    }

    // write local timestamp changes to database
    // does not need to be public when save button is removed
    /*tc.saveToDatabase = function () {
        dbStatus.textContent = "Saving…";

        // TODO: Remove save button for release
        dbSave.disabled = true;
        dbSave.textContent = "Saved";

        changesMade = true;

        var save_dict = {};
        if (localSelectedTimestamps.size > 0) {
            save_dict["selected"] = Array.from(localSelectedTimestamps);
        }
        if (localUnselectedTimestamps.size > 0) {
            save_dict["unselected"] = Array.from(localUnselectedTimestamps);
        }

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/save", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.onload = function () {
            saveOnload(xhr.status, xhr.response);
        }
        xhr.send(JSON.stringify(save_dict));

        for (let elem of localSelectedTimestamps) {
            selectedTimestamps.add(elem);
        }

        for (let elem of localUnselectedTimestamps) {
            selectedTimestamps.delete(elem);
        }

        localSelectedTimestamps = new Set();
        localUnselectedTimestamps = new Set();
    }

    function saveOnload(status, response) {
        if (status == 200) {
            dbStatus.textContent = "All changes saved";
        } else {
            dbStatus.textContent = "Failed to save changes (Error " + status + ")";
        }
    }*/

    /*
    function navUpdateSave() {
        if (localSelectedTimestamps.size == 0 && localUnselectedTimestamps.size == 0) {
            if (changesMade) {
                dbStatus.textContent = "All changes saved";
            } else {
                dbStatus.textContent = "Last modified: " + moment(lastModified).fromNow();
            }

            // TODO: Remove save button for release
            dbSave.disabled = true;
            dbSave.textContent = "Saved";
        } else {
            dbStatus.textContent = "Unsaved changes";

            // TODO: Remove save button for release
            dbSave.disabled = false;
            dbSave.textContent = "Save";
            // uncomment to enable autosave
            //saveToDatabase();
        }
    }*/

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

    /*tc.showTemplEdit = function () {
        templSelectForm.style.display = "none";
        templEditForm.style.display = "";

        if (templSelect.selectedIndex == 0) {
            // Making new template
            templEditTextInput.value = "New Template";
            templEditDelete.style.display = "none";
        } else {
            // Renaming existing template
            templEditTextInput.value = templSelect.options[templSelect.selectedIndex].text;
            templEditDelete.style.display = "";
        }

        // TODO: Revise template logic
        tc.templInputName(templEditTextInput);
        templEditTextInput.focus();
    }

    tc.hideTemplEdit = function () {
        //templatesTextInput.value = "";
        templSelectForm.style.display = "";
        templEditForm.style.display = "none";
    }

    // called when contents of template name input change
    tc.templInputName = function (e) {
        if (event.keyCode == 13) {
            saveNewTemplate();
        }
        // Disable save button unless template name is unique
        templEditSave.disabled = false;
        for (var i = 0; i < templSelect.length; i++) {
            if (e.value.trim() == templSelect.options[i].text) {
                // Disable save unless template timestamps or name changed
                templEditSave.disabled = true;
                break;
            }
        }
    }

    // save changes to the selected template
    tc.templSaveOption = function () {
        if (templSelect.selectedIndex == 0) {
            // TODO: creating new template with form
            templSelect.options[templSelect.options.length] = new Option(templEditTextInput.value.trim(), "new-template-value");
        } else {
            // TODO: modifying existing template with form
            templSelect.options[templSelect.selectedIndex] = new Option(templEditTextInput.value.trim(), "new-template-value");
        }
        tc.templSelectChanged();
        tc.hideTemplEdit();
    }

    // delete the selected template
    tc.templDeleteOption = function () {
        // can't delete None template
        if (templSelect.selectedIndex != 0) {
            templSelect.removeChild(templSelect.options[templSelect.selectedIndex]);
        }
        tc.templSelectChanged();
        tc.hideTemplEdit();
    }

    tc.templSelectChanged = function () {
        if (templSelect.selectedIndex == 0) {
            templNew.textContent = "New Template";
        } else {
            templNew.textContent = "Edit Template";
        }

        // Apply template to hours if not None
    }*/

    return tc;
})();
// Justin Carlson
