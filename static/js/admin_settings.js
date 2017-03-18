var TcAdmin = (function () {
    var tc = {};

    /* DOM elements */


    /* local variables */

    /* public variables */

    tc.init = function () {

    }

    function dbUpdateUsers() {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/admin/settings/update", true);
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

    return tc;
})();
// Justin Carlson