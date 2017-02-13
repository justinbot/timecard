var TcAdmin = (function () {
    var tc = {};

    /* DOM elements */
    var periodNavToday;
    var periodRange;

    var tsTable,
        tsHead,
        tsHeadCheckbox,
        tsHeadButton,
        tsDays = [];

    var userAddButton,
        userAddContainer,
        userAddStatus,
        userAddInputFirstname,
        userAddInputLastname,
        userAddInputId;

    var userViewAsButton,
        userEditButton,
        userDeleteButton;

    var infoBannerContainer,
        infoBannerText;

    var dbStatus;
    var tableStatus;

    /* local variables */
    var focusDate;
    var periodStart,
        periodEnd;

    var userData = {};
    var selectedUsers = new Set();

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

        userAddButton = document.getElementById("user-add-button");
        userAddContainer = document.getElementById("user-add-container");
        userAddStatus = document.getElementById("user-add-status");
        userAddInputFirstname = document.getElementById("user-add-input-firstname");
        userAddInputLastname = document.getElementById("user-add-input-lastname");
        userAddInputId = document.getElementById("user-add-input-id");

        userViewAsButton = document.getElementById("user-viewas-button");
        userEditButton = document.getElementById("user-edit-button");
        userDeleteButton = document.getElementById("user-delete-button");

        infoBannerContainer = document.getElementById("infobanner-container");
        infoBannerText = document.getElementById("infobanner-text");

        dbStatus = document.getElementById("db-status");
        tableStatus = document.getElementById("table-status");

        // TODO: Set up these values in HTML so page loads in correct state
        tc.infoBannerHide();
        tc.userAddCancel();

        tc.currentPeriod();
    }

    function onUserDataChanged() {
        updateTable();
    }

    function onSelectedUsersChanged() {
        updateCheckboxes();
        updateEdit();
    }

    function onPeriodChanged() {
        dbUpdateUsers();
        updateDays();
        updatePeriod();
    }

    function updateTable() {
        var oldTsBody = tsTable.getElementsByTagName("tbody")[0];
        var newTsBody = document.createElement("tbody");
        for (var elem in userData) {
            var userId = elem;
            var userFirst = userData[elem]["firstname"];
            var userLast = userData[elem]["lastname"];

            var newRow = newTsBody.insertRow();
            newRow.dataset.userid = userId;
            newRow.setAttribute("id", "ts-row-" + userId);
            //newRow.setAttribute("onclick", "TcAdmin.tableSelectRow(this.dataset.userid)");

            var checkCell = newRow.insertCell();
            var checkbox = document.createElement("input");
            checkbox.dataset.userid = userId;
            checkbox.setAttribute("id", "ts-row-" + userId + "-checkbox");
            checkbox.setAttribute("type", "checkbox");
            checkbox.setAttribute("onchange", "TcAdmin.tableSelectRow(this.dataset.userid)");
            if (selectedUsers.has(userId)) {
                checkbox.checked = true;
            }
            checkCell.appendChild(checkbox);

            var nameCell = newRow.insertCell();
            nameCell.style.color = "#3b5ca0";
            // TODO: nameInput should submit when enter pressed
            var nameInput = document.createElement("input");
            nameInput.dataset.userid = userId;
            nameInput.dataset.userfirst = userFirst;
            nameInput.dataset.userlast = userLast;
            nameInput.setAttribute("id", "ts-row-" + userId + "-nameinput");
            nameInput.setAttribute("type", "text");
            nameInput.setAttribute("onblur", "TcAdmin.userEditCancel(this.dataset.userid)")
            nameInput.style.display = "none";
            nameCell.appendChild(nameInput);
            var nameLabel = document.createElement("a");
            nameLabel.setAttribute("id", "ts-row-" + userId + "-namelabel");
            nameLabel.setAttribute("href", "/user/" + userId);
            nameLabel.setAttribute("target", "_blank");
            nameLabel.textContent = userLast + ", " + userFirst;
            nameCell.appendChild(nameLabel);

            var idCell = newRow.insertCell();
            idCell.textContent = userId;

            var lastModifiedCell = newRow.insertCell();
            // TODO: Keep initialDate up to date to prevent last modified appearing in future
            lastModifiedCell.textContent = moment(userData[elem]["lastmodified"]).fromNow(); //(tc.initialDate);

            for (var i = 0; i < tc.periodDuration; i++) {
                var dayCell = newRow.insertCell();
                dayCell.style.textAlign = "center";
                // TODO: Same rounding error as everywhere else
                dayCell.textContent = userData[elem]["ts-day-" + i].toFixed(1);;
            }

            var totalCell = newRow.insertCell();
            totalCell.style.textAlign = "center";
            totalCell.textContent = userData[elem]["total"].toFixed(1);
        }
        tsTable.replaceChild(newTsBody, oldTsBody);

        onSelectedUsersChanged();
    }

    function updateCheckboxes() {
        var userCount = Object.keys(userData).length;

        if (selectedUsers.size == userCount) {
            tsHeadCheckbox.indeterminate = false;
            if (userCount == 0) {
                tsHeadCheckbox.checked = false;
            } else {
                tsHeadCheckbox.checked = true;
            }
        } else if (selectedUsers.size == 0) {
            tsHeadCheckbox.indeterminate = false;
            tsHeadCheckbox.checked = false;
        } else {
            tsHeadCheckbox.indeterminate = true;
        }

        var tsBody = tsTable.getElementsByTagName("tbody")[0];
        var rows = tsBody.getElementsByTagName("tr");

        for (var i = 0; i < rows.length; i++) {
            var rowCheckbox = rows[i].children[0].children[0];
            if (selectedUsers.has(rows[i].dataset.userid)) {
                rowCheckbox.checked = true;
                rows[i].setAttribute("class", "tr-selected");
            } else {
                rowCheckbox.checked = false;
                rows[i].setAttribute("class", "");
            }
        }
    }

    function updateEdit() {
        if (selectedUsers.size == 0) {
            tableStatus.textContent = "Users: " + Object.keys(userData).length;
            userViewAsButton.style.display = "none";
            userEditButton.style.display = "none";
            userDeleteButton.style.display = "none";
        } else if (selectedUsers.size == 1) {
            var user = selectedUsers.values().next().value;
            tableStatus.textContent = userData[user]["firstname"] + " " + userData[user]["lastname"];
            userViewAsButton.href = "/user/" + user;
            userViewAsButton.style.display = "";
            userEditButton.style.display = "";
            userEditButton.dataset.userid = user;
            userDeleteButton.style.display = "";
        } else {
            tableStatus.textContent = selectedUsers.size + " users";
            userViewAsButton.style.display = "none";
            userEditButton.style.display = "none";
            userDeleteButton.style.display = "";
        }
    }

    function updateDays() {
        for (var i = 0; i < tsDays.length; i++) {
            var day = tsDays[i];
            var dayDate = moment(periodStart).add(i, "day");
            day.textContent = dayDate.format("MMM D"); //format("dddd, MMM D");
            //day.dataset.date = dayDate.format("YYYY-MM-DD")
        }
    }

    function updatePeriod() {
        periodNavToday.disabled = focusDate.isSame(tc.initialDate, "day");

        var startDate = moment(periodStart);
        var endDate = moment(periodEnd);
        if (startDate.isSame(endDate, "year")) {
            if (startDate.isSame(endDate, "month")) {
                periodRange.textContent = startDate.format("MMM D") + " – " + endDate.format("D, YYYY");
            } else {
                periodRange.textContent = startDate.format("MMM D") + " – " + endDate.format("MMM D, YYYY");
            }
        } else {
            periodRange.textContent = startDate.format("MMM D, YYYY") + " – " + endDate.format("MMM D, YYYY");
        }
    }

    function dbUpdateUsers() {
        var updateDict = {
            "days": {}
        };

        for (var i = 0; i < tsDays.length; i++) {
            var lower = moment(periodStart).add(i, "day").startOf("day").unix();
            var upper = moment(periodStart).add(i, "day").endOf("day").unix();


            updateDict["days"]["ts-day-" + i] = [lower, upper];
        }

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/admin/update", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            dbUpdateUsersOnload(xhr.status, xhr.response);
        }
        xhr.send(JSON.stringify(updateDict));
    }

    function dbUpdateUsersOnload(status, response) {
        if (status == 200) {
            userData = response;
            onUserDataChanged();
        } else {
            // TODO: Display error regarding status
        }
    }

    // TODO: Convert to dbAddUsers to take dict of ids to firstnames and lastnames
    function dbAddUser(firstname, lastname, id) {
        var addDict = {
            "firstname": firstname,
            "lastname": lastname,
            "id": id
        };

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/admin/add", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            dbAddUserOnload(xhr.status, xhr.response);
        }
        xhr.send(JSON.stringify(addDict));
    }

    function dbAddUserOnload(status, response) {
        if (status == 200) {
            tc.infoBannerShow("User successfully added");
        } else {
            tc.infoBannerShow("Failed to add user (Error " + status + ")");
        }
        dbUpdateUsers();
    }

    function dbEditUser(id, newId, newFirst, newLast) {
        var editDict = {
            "id": id,
            "new_id": newId,
            "new_first": newFirst,
            "new_last": newLast
        };

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/admin/edit", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            dbEditUserOnload(xhr.status, xhr.response);
        }
        xhr.send(JSON.stringify(editDict));
    }

    function dbEditUserOnload(status, response) {
        if (status == 200) {
            tc.infoBannerShow("User successfully edited");
        } else {
            tc.infoBannerShow("Failed to edit user (Error " + status + ")");
        }
        dbUpdateUsers();
    }

    // TODO: Convert to DeleteUsers and take array of ids
    function dbDeleteUser(id) {
        selectedUsers.delete(id);

        var deleteDict = {
            "id": id
        };

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/admin/delete", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            dbDeleteUserOnload(xhr.status, xhr.response);
        }
        xhr.send(JSON.stringify(deleteDict));
    }

    function dbDeleteUserOnload(status, response) {
        if (status == 200) {
            // TODO: Display undo banner with "Deleted [x] users" or "Deleted user [name]"
            tc.infoBannerShow("User successfully deleted");
        } else {
            tc.infoBannerShow("Failed to delete user (Error " + status + ")");
        }
        dbUpdateUsers();
    }

    tc.userAddShow = function () {
        userAddButton.style.width = "32px";
        userAddButton.setAttribute("class", "button-solid button-solid-green button-icon");
        userAddButton.setAttribute("onclick", "TcAdmin.userAddCancel()");
        userAddButton.innerHTML = "&#10006;";

        userAddContainer.style.display = "";
        userAddContainer.setAttribute("class", "action-container");
    }

    tc.userAddCancel = function () {
        userAddButton.style.width = "120px";
        userAddButton.setAttribute("class", "button-solid button-solid-green");
        userAddButton.setAttribute("onclick", "TcAdmin.userAddShow()");
        userAddButton.innerHTML = "+ Add User";

        userAddContainer.setAttribute("class", "action-container-hidden");

        userAddStatus.textContent = "";
        userAddInputFirstname.value = "";
        userAddInputLastname.value = "";
        userAddInputId.value = "";
    }

    tc.userAddSubmit = function () {
        // TODO: Also validate server-side
        if (userAddInputFirstname.value.length > 0 &&
            userAddInputLastname.value.length > 0 &&
            userAddInputId.value.length > 0) {
            dbAddUser(userAddInputFirstname.value, userAddInputLastname.value, userAddInputId.value);
            tc.userAddCancel();
        } else {
            userAddStatus.textContent = "Required fields: First Name, Last Name, and ID";
        }
    }

    tc.userEditShow = function (id) {
        var nameInput = document.getElementById("ts-row-" + id + "-nameinput");
        nameInput.style.display = "";
        nameInput.value = userData[id]["firstname"] + " " + userData[id]["lastname"];
        nameInput.focus();
        nameInput.select();

        var nameLabel = document.getElementById("ts-row-" + id + "-namelabel");
        nameLabel.style.display = "none";
    }

    tc.userEditCancel = function (id) {
        var nameInput = document.getElementById("ts-row-" + id + "-nameinput");
        nameInput.style.display = "none";
        if (nameInput.value != (userData[id]["firstname"] + " " + userData[id]["lastname"])) {
            // TODO: Revise functionality. Maybe go back to combined first and last name split serverside?
            var name = nameInput.value.split(" ", 2);
            console.log(name);
            dbEditUser(id, id, name[0], name[1]);
        } else {
            // TODO: Display invalid name message
        }

        var nameLabel = document.getElementById("ts-row-" + id + "-namelabel");
        nameLabel.style.display = "";
    }

    // TODO: Modify to use dbDeleteUsers to batch delete
    tc.userDeleteSelected = function () {
        for (var elem of selectedUsers) {
            dbDeleteUser(elem);
        }
    }

    tc.tableSelectAll = function (checkbox) {
        var checkboxes = tsTable.getElementsByTagName("tbody")[0].getElementsByTagName("input");
        for (var i = 0; i < checkboxes.length; i++) {
            checkboxes[i].checked = checkbox.checked;
            if (checkbox.checked) {
                selectedUsers.add(checkboxes[i].dataset.userid);
            }
        }
        if (!checkbox.checked) {
            selectedUsers.clear();
        }

        onSelectedUsersChanged();
    }

    tc.tableSelectRow = function (id) {
        console.log(id);
        if (selectedUsers.has(id)) {
            selectedUsers.delete(id);
        } else {
            selectedUsers.add(id);
        }

        onSelectedUsersChanged();
    }

    tc.infoBannerShow = function (text) {
        tc.infoBannerHide();
        infoBannerText.textContent = text;
        infoBannerContainer.setAttribute("class", "infobanner-container");
    }

    tc.infoBannerHide = function () {
        infoBannerContainer.setAttribute("class", "infobanner-container-hidden");
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


    /*

    tc.userEditSubmit = function () {
        // TODO: Make sure length > 0
        if (userEditInputName.value != userEditForm.dataset.name || userEditInputID.value != userEditForm.dataset.userid) {
            dbEditUser(userEditInputName.value, userEditInputID.value);
            tc.userEditCancel();
        } else {
            dbStatus.textContent = "Modify a field to submit";
        }
    }
    */

    return tc;
})();
// Justin Carlson