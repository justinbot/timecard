var TcAdmin = (function () {
    var tc = {};

    /* DOM elements */
    var periodNavToday;
    var periodRange;

    var tsTable;
    var tsHead;
    var tsHeadCheckbox;
    var tsHeadButton;
    var tsDays = [];

    var userNewButton;
    var userNewForm;
    var userNewInputName;
    var userNewInputID;

    var userEditForm;
    var userEditInputName;
    var userEditInputID;

    var dbStatus;
    var tableStatus;

    /* local variables */
    var focusDate;
    var periodStart;

    var userIds = new Set();
    var checkedUsers = new Set();

    /* public variables */
    tc.initialDate;
    tc.lockDate;
    tc.slotIncrement;
    tc.slotFirstStart;
    tc.periodDuration;
    tc.validPeriodStart;

    tc.init = function () {
        periodNavToday = document.getElementById("period-nav-today");
        periodRange = document.getElementById("period-range");

        tsTable = document.getElementById("ts-table");
        tsHead = document.getElementById("ts-head");
        tsHeadCheckbox = document.getElementById("ts-head-checkbox");
        tsHeadButton = document.getElementById("ts-head-button");

        for (var i = 0; i < tc.periodDuration; i++) {
            tsDays.push(document.getElementById("ts-day-" + i));
        }

        userNewButton = document.getElementById("user-new-button");
        userNewForm = document.getElementById("user-new-form");
        userNewInputName = document.getElementById("user-new-input-name");
        userNewInputID = document.getElementById("user-new-input-id");

        userEditForm = document.getElementById("user-edit-form");
        userEditInputName = document.getElementById("user-edit-input-name");
        userEditInputID = document.getElementById("user-edit-input-id");

        dbStatus = document.getElementById("db-status");
        tableStatus = document.getElementById("table-status");

        tc.currentPeriod();
    }

    function getFromDatabase() {
        var get_dict = {
            "days": {}
        };

        for (var i = 0; i < tsDays.length; i++) {
            var lower = moment(tsDays[i].dataset.date).startOf("day").unix();
            var upper = moment(tsDays[i].dataset.date).endOf("day").unix();

            get_dict["days"]["ts-day-" + i] = [lower, upper];
        }

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/admin/update", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            getOnload(xhr.status, xhr.response);
        }
        xhr.send(JSON.stringify(get_dict));
    }

    function getOnload(status, response) {
        if (status == 200) {
            var oldTsBody = tsTable.getElementsByTagName("tbody")[0];
            var newTsBody = document.createElement("tbody");

            userIds = new Set();
            for (var elem in response) {
                userIds.add(elem);

                var newRow = newTsBody.insertRow();

                var checkCell = newRow.insertCell();
                var checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.dataset.userid = elem;
                checkbox.setAttribute("onchange", "TcAdmin.tableCheckRow(this)");
                checkCell.appendChild(checkbox);

                var menuCell = newRow.insertCell();
                var menuButton = document.createElement("button");
                menuButton.setAttribute("class", "dots-button-1");
                menuCell.appendChild(menuButton);

                var nameCell = newRow.insertCell();

                var editButton = document.createElement("div");
                editButton.setAttribute("class", "icon-edit")
                editButton.setAttribute("onclick", "TcAdmin.userEditShow(this)");
                editButton.dataset.name = response[elem]["firstname"] + " " + response[elem]["lastname"];
                editButton.dataset.userid = elem;
                nameCell.appendChild(editButton);

                var nameText = document.createElement("a");
                nameText.setAttribute("class", "ts-link");
                nameText.setAttribute("href", "/user/" + elem);
                nameText.setAttribute("target", "_blank");
                nameText.textContent = response[elem]["lastname"] + ", " + response[elem]["firstname"];
                nameCell.appendChild(nameText);

                var lastModifiedCell = newRow.insertCell();
                lastModifiedCell.textContent = moment(response[elem]["lastmodified"]).fromNow(); //(tc.initialDate); TODO: Keep initialDate up to date

                for (var i = 0; i < tc.periodDuration; i++) {
                    var dayCell = newRow.insertCell();
                    dayCell.style.textAlign = "center";
                    // TODO: Same rounding error as everywhere else
                    dayCell.textContent = response[elem]["ts-day-" + i].toFixed(1);;
                }

                var totalCell = newRow.insertCell();
                totalCell.style.textAlign = "center";
                totalCell.textContent = response[elem]["total"].toFixed(1);
            }

            tsTable.replaceChild(newTsBody, oldTsBody);

            tableStatusUpdate();
        } else {
            // TODO: Display error regarding status
        }
    }

    function periodUpdate() {
        periodNavToday.disabled = focusDate.isSame(tc.initialDate, "day");

        var startDate = moment(tsDays[0].dataset.date)
        var endDate = moment(tsDays[tsDays.length - 1].dataset.date)
        if (startDate.isSame(endDate, "month")) {
            periodRange.textContent = startDate.format("MMM D") + " – " + endDate.format("D, YYYY");
        } else {
            periodRange.textContent = startDate.format("MMM D") + " – " + endDate.format("MMM D, YYYY");
        }
    }

    function tableStatusUpdate() {
        if (checkedUsers.size == 0) {
            tableStatus.textContent = userIds.size + " Users";
        } else {
            tableStatus.textContent = userIds.size + " Users (" + checkedUsers.size + " selected)";
        }

        if (checkedUsers.size == userIds.size) {
            tsHeadCheckbox.indeterminate = false;
            tsHeadCheckbox.checked = true;
        } else if (checkedUsers.size == 0) {
            tsHeadCheckbox.indeterminate = false;
            tsHeadCheckbox.checked = false;
        } else {
            tsHeadCheckbox.indeterminate = true;
        }

        if (checkedUsers.size < 2) {
            tsHeadButton.style.visibility = "hidden";
        } else {
            tsHeadButton.style.visibility = "visible";
        }
    }

    tc.currentPeriod = function () {
        focusDate = moment(tc.initialDate);
        periodStart = moment(tc.validPeriodStart);
        // Calculate start of the period the initialDate is in
        periodStart.add(Math.floor((focusDate.unix() - periodStart.unix()) / 60 / 60 / 24 / tc.periodDuration) * tc.periodDuration, "day");

        for (var i = 0; i < tsDays.length; i++) {
            tsUpdateDay(i);
        }

        periodUpdate();

        getFromDatabase();
    }

    tc.prevPeriod = function () {
        focusDate.subtract(tc.periodDuration, "day");
        periodStart.subtract(tc.periodDuration, "day");

        for (var i = 0; i < tsDays.length; i++) {
            tsUpdateDay(i);
        }

        periodUpdate();

        getFromDatabase();
    }

    tc.nextPeriod = function () {
        focusDate.add(tc.periodDuration, "day");
        periodStart.add(tc.periodDuration, "day");

        for (var i = 0; i < tsDays.length; i++) {
            tsUpdateDay(i);
        }

        periodUpdate();

        getFromDatabase();
    }

    function tsUpdateDay(d) {
        var day = tsDays[d];
        var dayDate = moment(periodStart).add(d, "day");
        day.textContent = dayDate.format("MMM D"); //format("dddd, MMM D");
        day.dataset.date = dayDate.format("YYYY-MM-DD")
    }

    tc.userNewShow = function () {
        userNewButton.style.display = "none";
        userNewForm.style.display = "";
        userNewInputName.focus();
    }

    tc.userNewSubmit = function () {
        // Validate input, use dbStatus for response
        // Also validate server-side
        if (userNewInputName.value.length > 0 && userNewInputID.value.length > 0) {
            dbNewUser(userNewInputName.value, userNewInputID.value);
            tc.userNewCancel();
        } else {
            dbStatus.textContent = "Required fields: Name and ID";
        }
    }

    tc.userNewCancel = function () {
        userNewButton.style.display = "";
        userNewForm.style.display = "none";
        userNewInputName.value = "";
        userNewInputID.value = "";

        dbStatus.textContent = "";
    }

    function dbNewUser(name, id) {
        var user_dict = {
            "name": name,
            "id": id
        };

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/admin/create", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            dbNewUserOnload(xhr.status, xhr.response);
        }
        xhr.send(JSON.stringify(user_dict));
    }

    function dbNewUserOnload(status, response) {
        if (status == 200) {
            dbStatus.textContent = "User creation successful";
        } else {
            dbStatus.textContent = "Failed to create user (Error " + status + ")";
        }
        getFromDatabase();
    }

    tc.userEditShow = function (button) {
        tc.userNewCancel();

        userNewButton.style.display = "none";
        userEditForm.style.display = "";

        userEditForm.dataset.name = button.dataset.name;
        userEditForm.dataset.userid = button.dataset.userid;

        userEditInputName.value = button.dataset.name;
        userEditInputName.placeholder = button.dataset.name;
        userEditInputID.value = button.dataset.userid;
        userEditInputID.placeholder = button.dataset.userid;
        userEditInputName.focus();
    }

    tc.userEditSubmit = function () {
        // TODO: Make sure length > 0
        if (userEditInputName.value != userEditForm.dataset.name || userEditInputID.value != userEditForm.dataset.userid) {
            dbEditUser(userEditInputName.value, userEditInputID.value);
            tc.userEditCancel();
        } else {
            dbStatus.textContent = "Modify a field to submit";
        }
    }

    tc.userEditDelete = function () {
        // TODO: Prompt "Are you sure?"
        dbDeleteUser(userEditForm.dataset.userid);
        tc.userEditCancel();
    }

    function dbDeleteUser(id) {
        var user_dict = {
            "id": userEditForm.dataset.userid
        };

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/admin/delete", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            dbDeleteUserOnload(xhr.status, xhr.response);
        }
        xhr.send(JSON.stringify(user_dict));
    }

    function dbDeleteUserOnload(status, response) {
        if (status == 200) {
            dbStatus.textContent = "User successfully deleted";
        } else {
            dbStatus.textContent = "Failed to delete user (Error " + status + ")";
        }
        getFromDatabase();
    }

    tc.userEditCancel = function () {
        userNewButton.style.display = "";
        userEditForm.style.display = "none";
        userEditInputName.value = "";
        userEditInputID.value = "";

        userEditForm.dataset.name = "";
        userEditForm.dataset.userid = "";

        dbStatus.textContent = "";
    }

    function dbEditUser(name, id) {
        var user_dict = {
            "id": userEditForm.dataset.userid,
            "new_name": name,
            "new_id": id
        };

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/admin/edit", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            dbEditUserOnload(xhr.status, xhr.response);
        }
        xhr.send(JSON.stringify(user_dict));
    }

    function dbEditUserOnload(status, response) {
        if (status == 200) {
            dbStatus.textContent = "User successfully edited";
        } else {
            dbStatus.textContent = "Failed to edit user (Error " + status + ")";
        }
        getFromDatabase();
    }

    tc.tableCheckAll = function (checkbox) {
        var checkboxes = tsTable.getElementsByTagName("tbody")[0].getElementsByTagName("input");
        for (var i = 0; i < checkboxes.length; i++) {
            checkboxes[i].checked = checkbox.checked;
            if (checkbox.checked) {
                checkedUsers.add(checkboxes[i].dataset.userid);
            }
        }
        if (!checkbox.checked) {
            checkedUsers.clear();
        }

        tableStatusUpdate();
    }

    tc.tableCheckRow = function (checkbox) {
        if (checkbox.checked) {
            checkedUsers.add(checkbox.dataset.userid);
        } else {
            checkedUsers.delete(checkbox.dataset.userid);
        }

        tableStatusUpdate();
    }

    return tc;
})();
// Justin Carlson