// TODO: Encapsulate with Immediately-invoked function expressions
var weekdays = [];

var tcNavToday;
var tcNavRange;
var tcNavTotal;

var templSelectContainer;
var templSelect;
var templNew;
var templEditContainer;
var templTextInput;
var templSave;
var templDelete;

var dbStatus;
var dbSave;

var slotIncrement;
var slotFirstStart;
var initialDate = moment.utc();
var focusDate;
// TODO: Add spec for timezone in cfg, store and manipulate all as utc/timestamp, display in timezone
//utc offset for est is -05:00. Times worked and displayed are in this zone
var currentTemplate = ""; // store template associated with each day? or just have a template if set

var localSelectedTimestamps = new Set();
var localUnselectedTimestamps = new Set();
var selectedTimestamps = new Set();

var initialLastModified;
var initialLoad = true;
var changesMade = false;

var dayTimestamps = {}; // Dictionary mapping day index to slot timestamps
var slotDown = false;
var slotToggleTo = true;

// TODO: Template delete button next to cancel. Also collect edit buttons (textinput, save, cancel, delete) in div
//       and normal buttons (select dropdown and edit button) in another div

function onload() {
    hideTemplEdit();
}

// fetch selectedTimestamps from database (selected in week range)
function getFromDatabase() {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "/update", true);
    // TODO: Give dates in header for which to fetch timestamps
    //xhr.setRequestHeader("Content-type", "application/json; charset=UTF-8");
    xhr.responseType = "json";
    xhr.onload = function () {
        // TODO: Deal with server errors here
        if (xhr.status == 200) {
            onLoadTimestamps(xhr.response);
        }
    }
    xhr.send();

    for (var i = 0; i < weekdays.length; i++) {
        updateDayHeader(i);
    }
}

function onLoadTimestamps(response) {
    if (initialLoad) {
        initialLastModified = moment.unix(response["modified"]);
        dbStatus.textContent = "Last modified: " + moment(initialLastModified).fromNow();
        dbSave.disabled = true;
        dbSave.textContent = "Saved";
        initialLoad = false;
    }

    selectedTimestamps = new Set();
    for (var i = 0; i < response["selected"].length; i++) {
        selectedTimestamps.add(response["selected"][i]);
    }

    for (var i = 0; i < weekdays.length; i++) {
        updateDayContent(i);
    }
}

// write localSelectedTimestamps to database
function saveToDatabase() {
    dbStatus.textContent = "Saving…";
    dbSave.disabled = true;
    dbSave.textContent = "Saved";
    changesMade = true;

    var timestamps = JSON.stringify({
        selected: Array.from(localSelectedTimestamps),
        unselected: Array.from(localUnselectedTimestamps)
    });
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/update", true);
    xhr.setRequestHeader("Content-type", "application/json; charset=UTF-8");
    xhr.onload = function () {
        onSaveTimestamps(xhr.response);
    }
    xhr.send(timestamps);

    for (let elem of localSelectedTimestamps) {
        selectedTimestamps.add(elem);
    }

    for (let elem of localUnselectedTimestamps) {
        selectedTimestamps.delete(elem);
    }

    localSelectedTimestamps = new Set();
    localUnselectedTimestamps = new Set();
}

function onSaveTimestamps(response) {
    // TODO: Deal with server save errors here

    dbStatus.textContent = "All changes saved";
}

// update date info for this day
function updateDayHeader(weekday) {
    var day = weekdays[weekday];
    var headerDate = day.children[0];
    var headerWeekday = day.children[1];

    // date associated with day at time of first slot
    var dayDate = moment(focusDate).startOf("week").add(weekday, "day");
    dayDate.set({
        "hour": slotFirstStart.hour(),
        "minute": slotFirstStart.minute()
    })
    day.dataset.date = dayDate.unix();

    headerDate.textContent = dayDate.format("MM[/]DD[/]YY");
    headerWeekday.textContent = dayDate.format("dddd");
}

// update slots of this day
function updateDayContent(weekday) {
    var day = weekdays[weekday];

    var slots = day.getElementsByTagName("td");
    dayTimestamps[weekday] = [];
    for (var i = 0; i < slots.length; i++) {
        // update timestamp of every slot by using its delta (seconds from first slot)
        // dataset values are stored as strings and must be parsed
        var ts = slots[i].dataset.timestamp = (parseInt(day.dataset.date) + parseInt(slots[i].dataset.timedelta)).toString();
        dayTimestamps[weekday].push(ts);
        // time is selected if it was selected locally, or was selected in the database and not unselected locally
        if ((selectedTimestamps.has(ts) && !localUnselectedTimestamps.has(ts)) || localSelectedTimestamps.has(ts)) {
            slots[i].className = "tc-slot-selected";
        } else {
            slots[i].className = "tc-slot";
        }
    }

    updateDayHours(weekday);
}

// update hours label in header of this day
function updateDayHours(weekday) {
    var day = weekdays[weekday];
    var headerHours = day.children[2];

    var dayTotalHours = 0.0;
    for (var i = 0; i < dayTimestamps[weekday].length; i++) {
        var ts = dayTimestamps[weekday][i];
        // time is selected if it was selected locally, or was selected in the database and not unselected locally
        if ((selectedTimestamps.has(ts) && !localUnselectedTimestamps.has(ts)) || localSelectedTimestamps.has(ts)) {
            dayTotalHours += (slotIncrement / 60);
        }
    }

    // TODO: Resolve issue where 15 minute increment gets rounded to 0.3 hours
    day.dataset.totalhours = dayTotalHours;
    headerHours.textContent = "Hours: " + dayTotalHours.toFixed(1);

    // only needs to update hours for this day
    updateNavTotal();
}

function updateNav() {
    tcNavToday.disabled = focusDate.isSame(initialDate, "day");
    tcNavRange.textContent = moment(focusDate).startOf("week").format("MMM D") + " – " + moment(focusDate).endOf("week").format("D, YYYY");
}

function updateNavTotal() {
    var totalHours = 0.0;
    for (var i = 0; i < weekdays.length; i++) {
        totalHours += parseFloat(weekdays[i].dataset.totalhours);
    }

    // TODO: Same precision issue as day hours
    tcNavTotal.textContent = "Total Hours: " + totalHours.toFixed(1);
}

function currentWeek() {
    focusDate = moment(initialDate);
    updateNav();
    getFromDatabase();
}

// move focused date back one week
function prevWeek() {
    focusDate.subtract(1, "week");
    updateNav();
    getFromDatabase();
}

// move focused date forward one week
function nextWeek() {
    focusDate.add(1, "week");
    updateNav();
    getFromDatabase();

}

// returns true if slot is selected, else false
function slotSelected(slot) {
    return (slot.className == "tc-slot-selected");
}

function slotSelect(slot) {
    // this check may not be necessary
    if (!slotSelected(slot)) {
        slot.className = "tc-slot-selected";

        if (!selectedTimestamps.has(slot.dataset.timestamp)) {
            localSelectedTimestamps.add(slot.dataset.timestamp);
        }

        if (localUnselectedTimestamps.has(slot.dataset.timestamp)) {
            localUnselectedTimestamps.delete(slot.dataset.timestamp);
        }

        updateDayHours(slot.dataset.weekday);
    } else {
        console.error("selecting already selected slot");
    }
}

function slotUnselect(slot) {
    if (slotSelected(slot)) {
        slot.className = "tc-slot";

        if (localSelectedTimestamps.has(slot.dataset.timestamp)) {
            localSelectedTimestamps.delete(slot.dataset.timestamp);
        }

        // if this was originally selected from the database, add it to be unselected
        if (selectedTimestamps.has(slot.dataset.timestamp)) {
            localUnselectedTimestamps.add(slot.dataset.timestamp);
        }

        updateDayHours(slot.dataset.weekday);
    } else {
        console.error("unselecting already unselected slot");
    }
}

function slotMouseOver(slot) {
    if (!slotDown) {
        return;
    }
    if (slotToggleTo) {
        // changing slots to selected, only if not already selected
        if (!slotSelected(slot)) {
            slotSelect(slot);
        }
    } else {
        // changing slots to unselected, only if already selected
        if (slotSelected(slot)) {
            slotUnselect(slot);
        }
    }
    // Hours changed, no longer template-valid
}

function slotMouseDown(slot) {
    slotDown = true;
    slotToggleTo = !slotSelected(slot);
    slotMouseOver(slot);
}

function slotMouseUp() {
    slotDown = false;

    // if there are no changes to be saved, display last modified and disable save button
    if (localSelectedTimestamps.size == 0 && localUnselectedTimestamps.size == 0) {
        if (!changesMade) {
            dbStatus.textContent = "Last modified: " + moment(initialLastModified).fromNow();
        } else {
            dbStatus.textContent = "All changes saved";
        }
        dbSave.disabled = true;
        dbSave.textContent = "Saved";
    } else {
        dbStatus.textContent = "Unsaved changes";
        dbSave.disabled = false;
        dbSave.textContent = "Save";
        // uncomment to enable autosave
        //saveToDatabase();
    }
}

function showTemplEdit() {
    templSelectContainer.style.display = "none";
    templEditContainer.style.display = "inline-block";

    if (templSelect.selectedIndex == 0) {
        // Making new template
        templTextInput.value = "New Template";
        templDelete.style.display = "none";
    } else {
        // Renaming existing template
        templTextInput.value = templSelect.options[templSelect.selectedIndex].text;
        templDelete.style.display = "inline-block";
    }

    templInputName(templTextInput);
    templTextInput.focus();
}

function hideTemplEdit() {
    //templatesTextInput.value = "";
    templSelectContainer.style.display = "inline-block";
    templEditContainer.style.display = "none";
}

// called when contents of template name input change
function templInputName(e) {
    /* if (event.keyCode == 13) {
        saveNewTemplate();
    }*/
    // Disable save button unless template name is unique
    templSave.disabled = false;
    for (var i = 0; i < templSelect.length; i++) {
        if (e.value.trim() == templSelect.options[i].text) {
            // Disable save unless template timestamps or name changed
            templSave.disabled = true;
            break;
        }
    }
}

// save changes to the selected template
function templSaveOption() {
    if (templSelect.selectedIndex == 0) {
        // creating new template
        templSelect.options[templSelect.options.length] = new Option(templTextInput.value.trim(), "new-template-value");
    } else {
        // TODO: modifying existing template
        templSelect.options[templSelect.selectedIndex] = new Option(templTextInput.value.trim(), "new-template-value");
    }
    templSelectChanged();
    hideTemplEdit();
}

// delete the selected template
function templDeleteOption() {
    // can't delete None template
    if (templSelect.selectedIndex != 0) {
        templSelect.removeChild(templSelect.options[templSelect.selectedIndex]);
    }
    templSelectChanged();
    hideTemplEdit();
}

function templSelectChanged() {
    if (templSelect.selectedIndex == 0) {
        templNew.textContent = "New Template";
    } else {
        templNew.textContent = "Edit Template";
    }

    // Apply template to hours if not None
}
