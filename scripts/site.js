(function ($) {

    var toggleStyle = function (elementSelector, nightCss, dayCss) {
        var styleElement = $(elementSelector)[0];
        var current = styleElement.href;

        if (current.indexOf(nightCss) >= 0) {
            current = current.replace(nightCss, dayCss);
        } else if (current.indexOf(dayCss) >= 0) {
            current = current.replace(dayCss, nightCss);
        }

        styleElement.href = current;
        saveTheme(elementSelector, current);
    }

    var toggleBootswatch = function () {
        toggleStyle(
            "link#bootswatch-style",
            "content/bootswatch-darkly.min.css",
            "content-bootswatch-flatly.min.css"
        );
    }

    var togglePrism = function () {
        toggleStyle(
            "link#prism-style",
            "content/prism.night.css",
            "content/prism.default.css"
        );
    }

    var toggleTheme = function() {
        toggleBootswatch();
        togglePrism();
    }

    var saveTheme = function (elementSelector, value) {
        if (window.localStorage && window.localStorage.setItem) {
            window.localStorage.setItem(elementSelector, value);
        }
    }

    var getSavedTheme = function (elementSelector) {
        if (window.localStorage && window.localStorage[elementSelector]) {
            return window.localStorage[elementSelector];
        }

        return null;
    }

    var getCurrentTheme = function (elementSelector) {
        var styleElement = $(elementSelector)[0];
        return styleElement.href;
    }

    var bootswatchSelector = "link#bootswatch-style";
    var savedTheme = getSavedTheme(bootswatchSelector);

    if (savedTheme && savedTheme !== getCurrentTheme(bootswatchSelector)) {
        toggleTheme();
    }

    $("a#theme-toggle").click(function (click) {
        toggleTheme();
        click.preventDefault();
        return false;
    });

    $(".post-content img").addClass("img-fluid");

})(window.jQuery);