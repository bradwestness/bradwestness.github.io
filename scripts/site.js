(function ($) {

    var toggleTheme = function () {
        var themeStyle = $("link#theme-style")[0];
        var nightCss = "content/bootswatch-darkly.min.css";
        var dayCss = "content/bootswatch-flatly.min.css";
        var current = themeStyle.href;

        if (current.indexOf(nightCss) >= 0) {
            current = current.replace(nightCss, dayCss);
        } else if (current.indexOf(dayCss) >= 0) {
            current = current.replace(dayCss, nightCss);
        }

        themeStyle.href = current;
        saveTheme(current);
    }

    var saveTheme = function (theme) {
        if (window.localStorage && window.localStorage.setItem) {
            window.localStorage.setItem("theme", theme);
        }
    }

    var getSavedTheme = function () {
        if (window.localStorage && window.localStorage.theme) {
            return window.localStorage.theme;
        }

        return null;
    }

    var getCurrentTheme = function(){
        var themeStyle = $("link#theme-style")[0];
        return themeStyle.href;
    }

    var savedTheme = getSavedTheme();

    if (savedTheme && savedTheme !== getCurrentTheme()){
        toggleTheme();
    }

    $("a#theme-toggle").click(function (click) {
        toggleTheme();
        click.preventDefault();
        return false;
    });

    $(".post-content img").addClass("img-fluid");    
    

})(window.jQuery);