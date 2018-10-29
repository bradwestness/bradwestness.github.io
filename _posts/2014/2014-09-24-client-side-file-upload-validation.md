---
layout: post
title: "Client-side File Upload Size Validation in ASP.NET MVC"
categories: [.NET, Programming]
---
  
Here's a little ASP.NET MVC validation attribute you might find useful: file size validation, complete with client-side validation using the [HTML5 File API](). We're using bytes for the file size, just for simplicity's sake.

First, the server-side validation attribute:

<pre><code class="language-csharp">using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Web;
using System.Web.Mvc;

namespace MyProject.Web
{
    [AttributeUsage(AttributeTargets.Field | AttributeTargets.Property, AllowMultiple = false, Inherited = true)]
    public class FileSizeAttribute : ValidationAttribute, IClientValidatable
    {
        public int? MaxBytes { get; set; }

        public FileSizeAttribute(int maxBytes)
            : base("Please upload a supported file.")
        {
            MaxBytes = maxBytes;
            if (MaxBytes.HasValue)
            {
                ErrorMessage = "Please upload a file of less than " + MaxBytes.Value + " bytes.";
            }
        }

        public override bool IsValid(object value)
        {
            HttpPostedFileBase file = value as HttpPostedFileBase;
            if (file != null)
            {
                bool result = true;

                if (MaxBytes.HasValue)
                {
                    result &= (file.ContentLength < MaxBytes.Value);
                }

                return result;
            }

            return true;
        }

        public IEnumerable<ModelClientValidationRule> GetClientValidationRules(ModelMetadata metaData, ControllerContext context)
        {
            var rule = new ModelClientValidationRule
            {
                ValidationType = "filesize",
                ErrorMessage = FormatErrorMessage(metaData.DisplayName)
            };
            rule.ValidationParameters["maxbytes"] = MaxBytes;
            yield return rule;
        }
    }
}</code></pre>

Second, the client-side implementation for jQuery.Validate:

<pre><code class="language-javascript">$(function () {
    jQuery.validator.unobtrusive.adapters.add('filesize', ['maxbytes'], function (options) {
        // Set up test parameters
        var params = {
            maxbytes: options.params.maxbytes
        };

        // Match parameters to the method to execute
        options.rules['filesize'] = params;
        if (options.message) {
            // If there is a message, set it for the rule
            options.messages['filesize'] = options.message;
        }
    });

    jQuery.validator.addMethod("filesize", function (value, element, param) {
        if (value === "") {
            // no file supplied
            return true;
        }

        var maxBytes = parseInt(param.maxbytes);

        // use HTML5 File API to check selected file size
        // https://developer.mozilla.org/en-US/docs/Using_files_from_web_applications
        // http://caniuse.com/#feat=fileapi
        if (element.files != undefined && element.files[0] != undefined && element.files[0].size != undefined) {
            var filesize = parseInt(element.files[0].size);

            return filesize <= maxBytes;
        }

        // if the browser doesn't support the HTML5 file API, just return true
        // since returning false would prevent submitting the form 
        return true;
    });
}(jQuery));</code></pre>

Note that this validation doesn't imply that the file upload is required, you would still need to use a <code class="language-csharp">[Required]</code> attribute if you want that behavior. Also, [if the user's browser doesn't support the File API](http://caniuse.com/#feat=fileapi), it will just validate the input no matter what, and fall back to server-side validation.

Also, if you're going over the default (4 MB as of this writing), you can do so by setting a <code class="language-aspnet">maxAllowedContentLength</code> attribute in your projects <code class="language-aspnet">web.config</code>:

<pre><code class="language-aspnet">&lt;system.webServer&gt;
    &lt;security&gt;
      &lt;requestFiltering&gt;
        &lt;requestLimits maxAllowedContentLength="52428800" /&gt; &lt;!--50MB--&gt;
      &lt;/requestFiltering&gt;
    &lt;/security&gt;
  &lt;/system.webServer&gt;</code></pre>
