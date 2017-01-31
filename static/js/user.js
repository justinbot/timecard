var TcUser = (function () {
    var tc = {};

    /* DOM elements */

    var tcNavToday;
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

    var tcDays = [];

    /* local variables */
    var currentTemplate = ""; // store template associated with each day? or just have a template if set

    var localSelectedTimestamps = new Set();
    var localUnselectedTimestamps = new Set();
    var selectedTimestamps = new Set();
    var focusDate;
    var weekStart;
    var lastModified;

    var changesMade = false;
    var locked = false;
    var dayHours = [];
    var totalHours = 0.0;

    var slotDown = false;
    var slotToggleTo = true;

    /* public variables */
    tc.initialDate;
    tc.lockDate;
    tc.slotIncrement;
    tc.slotFirstStart;
    tc.payPeriod;
    tc.payDay;


    tc.init = function () {
        templSelectForm = document.getElementById("templ-select-form");
        templSelect = document.getElementById("templ-select");
        templNew = document.getElementById("templ-new");
        templEditForm = document.getElementById("templ-edit-form");
        templEditTextInput = document.getElementById("templ-edit-textinput");
        templEditSave = document.getElementById("templ-edit-save");
        templEditDelete = document.getElementById("templ-edit-delete");

        dbStatus = document.getElementById("db-status");
        dbSave = document.getElementById("database-save");

        tcNavToday = document.getElementById("tc-nav-today");
        tcNavRange = document.getElementById("tc-nav-range");
        tcNavTotal = document.getElementById("tc-nav-total");

        for (var i = 0; i < 7; i++) {
            tcDays.push(document.getElementById("tc-day-" + i));
        }

        tc.hideTemplEdit();

        tc.currentWeek();
    }

    // fetch data from database in range of this week
    function getFromDatabase() {
        dbStatus.textContent = "Loading…";

        // specify range of timestamps to select
        var get_range = {
            "range": [moment(focusDate).startOf("week").unix(), moment(focusDate).endOf("week").unix()]
        };

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/update", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            getOnload(xhr.status, xhr.response);
        }
        xhr.send(JSON.stringify(get_range));
    }

    function getOnload(status, response) {
        if (status == 200) {
            // week considered locked
            locked = tcDays[tcDays.length - 1].dataset.date <= tc.lockDate;

            lastModified = moment(response["lastmodified"]);

            navUpdateSave();

            selectedTimestamps = new Set();
            for (var i = 0; i < response["selected"].length; i++) {
                selectedTimestamps.add(response["selected"][i]);
            }

            totalHours = 0.0;
            for (var i = 0; i < tcDays.length; i++) {
                dayUpdateContent(i);
            }

            navUpdateTotal();
        } else {
            dbStatus.textContent = "Failed to load data (Error " + status + ")";
            // TODO: Potentially store a persistent message for errors, last modified, etc.
            // so message doesn't disappear on cell mouse over
        }
    }

    // write local timestamp changes to database
    // does not need to be public when save button is removed
    tc.saveToDatabase = function () {
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
    }

    function navUpdate() {
        tcNavToday.disabled = focusDate.isSame(tc.initialDate, "day");
        var startDate = moment.unix(tcDays[0].dataset.date)
        var endDate = moment.unix(tcDays[tcDays.length - 1].dataset.date)
        if (startDate.isSame(endDate, "month")) {
            tcNavRange.textContent = startDate.format("MMM D") + " – " + endDate.format("D, YYYY");
        } else {
            tcNavRange.textContent = startDate.format("MMM D") + " – " + endDate.format("MMM D, YYYY");
        }
    }

    function navUpdateTotal() {
        // TODO: Same precision issue as day hours
        if (locked) {
            tcNavTotal.textContent = "Locked | Total Hours: " + totalHours.toFixed(1);
        } else {
            tcNavTotal.textContent = "Total Hours: " + totalHours.toFixed(1);
        }
    }

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
    }

    // set focused date to current week
    tc.currentWeek = function () {
        focusDate = moment(tc.initialDate);
        // TODO: Change to periodStart, start of pay period
        weekStart = moment(focusDate).startOf("week");

        getFromDatabase();

        for (var i = 0; i < tcDays.length; i++) {
            dayUpdateHeader(i);
        }

        navUpdate();
        tc.hideTemplEdit();
    }

    // move focused date back one week
    tc.prevWeek = function () {
        focusDate.subtract(1, "week");
        weekStart = moment(focusDate).startOf("week");

        getFromDatabase();

        for (var i = 0; i < tcDays.length; i++) {
            dayUpdateHeader(i);
        }

        navUpdate();
        tc.hideTemplEdit();
    }

    // move focused date forward one week
    tc.nextWeek = function () {
        focusDate.add(1, "week");
        weekStart = moment(focusDate).startOf("week");

        getFromDatabase();

        for (var i = 0; i < tcDays.length; i++) {
            dayUpdateHeader(i);
        }

        navUpdate();
        tc.hideTemplEdit();
    }

    tc.showTemplEdit = function () {
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
        /* if (event.keyCode == 13) {
            saveNewTemplate();
        }*/
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
    }

    // update date info for this day
    function dayUpdateHeader(d) {
        var day = tcDays[d];

        // date associated with day at time of first slot
        var dayDate = moment(weekStart).add(d, "day");
        dayDate.set({
            "hour": tc.slotFirstStart.hour(),
            "minute": tc.slotFirstStart.minute()
        })
        day.dataset.date = dayDate.unix();

        // highlight header of current day
        if (dayDate.isSame(tc.initialDate, "day")) {
            day.style.background = "#f5f5f5";
        } else {
            day.style.background = "";
        }

        day.children[0].textContent = dayDate.format("dddd, MMM D");
    }

    // update slots of this day
    function dayUpdateContent(d) {
        var day = tcDays[d];
        var slots = day.getElementsByTagName("td");

        //var dayLocked = day.dataset.date <= tc.lockDate;//focusDate.isSameOrBefore(tc.lockDate);

        dayHours[d] = 0.0;
        for (var i = 0; i < slots.length; i++) {
            // update timestamp of every slot by using its delta (seconds from first slot)
            // dataset values are stored as strings and must be parsed
            var ts = slots[i].dataset.timestamp = (parseInt(day.dataset.date) + parseInt(slots[i].dataset.timedelta)).toString();
            // time is selected if it was selected locally, or was selected in the database and not unselected locally
            if (localSelectedTimestamps.has(ts) || (selectedTimestamps.has(ts) && !localUnselectedTimestamps.has(ts))) {
                if (locked) {
                    slots[i].className = "tc-slot-selected-locked";
                } else {
                    slots[i].className = "tc-slot-selected";
                }
                dayHours[d] += tc.slotIncrement;
            } else {
                if (locked) {
                    slots[i].className = "tc-slot-locked";
                } else {
                    slots[i].className = "tc-slot";
                }
            }
        }

        totalHours += dayHours[d];
        day.children[1].textContent = "Hours: " + dayHours[d].toFixed(1);
    }

    function daySlotSelected(d) {
        dayHours[d] += tc.slotIncrement;
        tcDays[d].children[1].textContent = "Hours: " + dayHours[d].toFixed(1);

        totalHours += tc.slotIncrement;
        navUpdateTotal();
    }

    function daySlotUnselected(d) {
        dayHours[d] -= tc.slotIncrement;
        tcDays[d].children[1].textContent = "Hours: " + dayHours[d].toFixed(1);

        totalHours -= tc.slotIncrement;
        navUpdateTotal();
    }

    function slotSelect(slot) {
        // this check may not be necessary
        if (slot.className == "tc-slot") {
            slot.className = "tc-slot-selected";

            if (!selectedTimestamps.has(slot.dataset.timestamp)) {
                localSelectedTimestamps.add(slot.dataset.timestamp);
            }

            if (localUnselectedTimestamps.has(slot.dataset.timestamp)) {
                localUnselectedTimestamps.delete(slot.dataset.timestamp);
            }

            // TODO: slot changes have been made, no longer template-valid

            daySlotSelected(slot.dataset.weekday);
        } else {
            console.error("selecting already selected slot");
        }
    }

    function slotUnselect(slot) {
        if (slot.className == "tc-slot-selected") {
            slot.className = "tc-slot";

            if (localSelectedTimestamps.has(slot.dataset.timestamp)) {
                localSelectedTimestamps.delete(slot.dataset.timestamp);
            }

            // if this was originally selected from the database, add it to be unselected
            if (selectedTimestamps.has(slot.dataset.timestamp)) {
                localUnselectedTimestamps.add(slot.dataset.timestamp);
            }

            // TODO: slot changes have been made, no longer template-valid

            daySlotUnselected(slot.dataset.weekday);
        } else {
            console.error("unselecting already unselected slot");
        }
    }

    tc.slotMouseOver = function (slot) {
        if (!slotDown) {
            return;
        }
        if (slotToggleTo) {
            // changing slots to selected, only if not already selected
            if (slot.className == "tc-slot") {
                slotSelect(slot);
            }
        } else {
            // changing slots to unselected, only if already selected
            if (slot.className == "tc-slot-selected") {
                slotUnselect(slot);
            }
        }
    }

    tc.slotMouseDown = function (slot) {
        slotDown = true;
        slotToggleTo = slot.className == "tc-slot";
        tc.slotMouseOver(slot);
    }

    tc.slotMouseUp = function () {
        slotDown = false;
        navUpdateSave();
    }

    return tc;
})();
// Justin Carlson