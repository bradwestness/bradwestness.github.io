(function ($) {

    var getCookie = function (key) {
        var cookie = key + "=";
        var decoded = decodeURIComponent(document.cookie);
        var ca = decoded.split(';');

        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];

            while (c.charAt(0) === ' ') {
                c = c.substring(1);                
            }

            if (c.indexOf(cookie) === 0) {
                return c.substring(cookie.length, c.length);
            }
        }

        return "";
    }

    var setCookie = function(key, value, expiryDays) {
        var d = new Date();
        d.setTime(d.getTime() + (expiryDays * 24 * 60 * 60 * 1000));

        var expires = "expires=" + d.toUTCString();
        document.cookie = key + "=" + value + ";" + expires + ";path=/";
    }

    var cookieAlert = $("#cookie-alert");
    var acceptCookies = $("#accept-cookies");
    var cookieName = "acceptCookies";

    if (cookieAlert){
        cookieAlert.offsetHeight;
        if (!getCookie(cookieName)) {
            cookieAlert.removeClass("d-none");
        }
    }

    acceptCookies.click(function(click) {
        setCookie(cookieName, true, 365);
        cookieAlert.addClass("d-none");
    });

    $(".post-content img").addClass("img-fluid w-100");
    
    $(".post-content table").addClass("table table-bordered table-striped");

})(window.jQuery);