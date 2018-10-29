---
layout: post
title: Signing and Encoding iOS Configuration Profiles with C#  
categories: [Software, .NET, Programming]
---
  
I'm currently in the process of developing a Mobile Device Management web application for <a href="http://www.uww.edu">UW-Whitewater</a>, which has been largely an exercise in trial and error due to the cryptic nature of <a href="http://www.apple.com/support/iphone/enterprise/">Apple's documentation on the subject</a> (which assume you're developing on Mac OS and running a Mac OS server) and the dearth of information available from other sources.

After getting the secure signing and encoding of profiles working, I decided to post my results here, in case they are of use to anyone else. I'm assuming you've already generated the profile you want to send to the device, so this post will just cover signing and encrypting the profile so the device will show it as <strong>Verified</strong> rather than <strong>Not Verified</strong> or <strong>Unsigned</strong>.

## 1. Loading the Signing Certificate

You need to have an SSL certificate installed on your server, from some Certificate Authority or another (like <a href="http://www.verisigninc.com/">VeriSign</a> or <a href="http://www.entrust.net/">Entrust</a>). The iOS device has an internal list of certificate authorities that it "trusts" natively, but that shouldn't matter because we're going to include the full chain of certificates with the profile. The only thing that won't work are <strong>self-signed</strong> certificates, as there's no certificate authority present so the device will show the profile as <strong>Not Verified</strong>.

### Specify Which Certificate to Use

Load up IIS Manager on the server and click on the server node in the tree view on the left. Click on <em>Server Certificates</em> in the content section. Now, double-click the certificate that you want to use to sign the profiles.

Switch to the <strong>Details</strong> tab and note the <em>Subject</em>. We'll use this as a key to load the certificate dynamically from within your application. You don't need the whole thing, just a portion of it that will allow you to find it uniquely.

![]({{ site.baseurl }}content/images/certificate_details.png)

### Find and Load the Certificate

There are a number of certificate stores and locations that the certificate can be stored in. I decided to just search through all possible combinations so it doesn't matter which store my certificate is in. We just need to loop through each store and location combination and find the certificate that matches the subject we just looked up.

<pre><code class="language-csharp">    using System.Collections;
    using System.Linq;
    using System.Security.Cryptography.X509Certificates;

    ...

    private static X509Certificate2 GetSigningCertificate(string subject)
    {
        X509Certificate2 theCert = null;
        foreach (StoreName name in Enum.GetValues(typeof (StoreName)))
        {
            foreach (StoreLocation location in Enum.GetValues(typeof (StoreLocation)))
            {
                var store = new X509Store(name, location);
                store.Open(OpenFlags.ReadOnly);
                foreach (X509Certificate2 cert in store.Certificates)
                {
                    if (cert.Subject.ToLower().Contains(subject.ToLower()) &amp;&amp; cert.HasPrivateKey)
                    {
                        theCert = cert;
                        break;
                    }
                }
                store.Close();
            }
        }
        if (theCert == null)
        {
            throw new Exception(
                String.Format("No certificate found containing a subject '{0}'.",
                              subject));
        }

        return theCert;
    }
</code></pre>

*Note: "<code lang="csharp">subject</code>" should be set to the certificate subject you looked up above.

## 2. Encode and Sign the Profile

I used the <a href="http://www.bouncycastle.org/csharp/">BouncyCastle</a> cryptographic library to sign the profiles. It's available as a <a href="http://nuget.org/">NuGet</a> package, so it's easy to add to your project.

This is the same library Apple uses in the <a href="http://support.apple.com/kb/DL1466">iPhone Configuration Utility for Windows</a> so it seemed like a natural choice. I had no luck getting the certificate signing to work using soley the built in <code lang="csharp">System.Security</code> classes provided by the .NET Framework.

<pre><code class="language-csharp">using Org.BouncyCastle.Cms;
using Org.BouncyCastle.Crypto;
using Org.BouncyCastle.Security;
using Org.BouncyCastle.X509;
using Org.BouncyCastle.X509.Store;
using X509Certificate = Org.BouncyCastle.X509.X509Certificate;

...

    private static byte[] EncodeAndSign(string input)
    {
        AsymmetricCipherKeyPair keyPair = DotNetUtilities.GetKeyPair(_signingCertificate.PrivateKey);
        X509Certificate bouncy = new X509CertificateParser().ReadCertificate(_signingCertificate.GetRawCertData());
        byte[] content = new UTF8Encoding().GetBytes(input);
        var signedDataGenerator = new CmsSignedDataGenerator();
        var processableByteArray = new CmsProcessableByteArray(content);

        IList certCollection = new ArrayList();
        var chain = new X509Chain();
        chain.Build(_signingCertificate);
        foreach (X509ChainElement link in chain.ChainElements)
        {
            certCollection.Add(DotNetUtilities.FromX509Certificate(link.Certificate));
        }
        IX509Store certStore = X509StoreFactory.Create("Certificate/Collection",
                                                       new X509CollectionStoreParameters(
                                                           certCollection));

        signedDataGenerator.AddCertificates(certStore);
        signedDataGenerator.AddSigner(keyPair.Private, bouncy, CmsSignedGenerator.DigestSha1);

        CmsSignedData signedData = signedDataGenerator.Generate(processableByteArray, true);
        return signedData.GetEncoded();
    }
</code></pre>

*Note: <code lang="csharp">_signingCertificate</code> is the result from the GetSigningCertificate() method, stored in a static variable so we don't have to search for it every time. The <code lang="csharp">input</code> parameter should be a string containing the configuration profile you wish to send to the device.*

This method will take your configuration profile and return it as a byte array, UTF-8 encoded, signed, and encrypted, just the way the device likes.

The <code lang="csharp">certCollection</code> section retrieves the entire signature chain for your SSL certificate so the Certificate Authority and any intermediate certificates will be included with the profile.

## 3. Deliver the Profile to the Device

I chose to write my application using the <a href="http://www.asp.net/mvc">ASP.NET MVC framework</a>. In order to deliver the signed and encrypted profile to the device, I can return a <code lang="csharp">FileContentResult</code> containing the byte array from the <code lang="csharp">EncodeAndSign()</code> method above.

The MIME-type should be <code lang="csharp">"application/x-apple-aspen-config"</code>. The filename should end with <code lang="csharp">.mobileconfig</code> but you can name the first portion whatever you like.

<pre><code class="language-csharp">return File(profile, "application/x-apple-aspen-config", "profile.mobileconfig");    
</code></pre>

*Note: Even if you are not using ASP.NET MVC, there is no need to cast the encoded bytes back to a string before writing them to your HTTP response. In fact, doing so will result in a useless, garbled string that will only cause an error to be thrown when you attempt to install the profile on your device. Write the encoded byte array directly to the HTTP response using the <a href="http://msdn.microsoft.com/en-us/library/system.web.httpresponse.binarywrite.aspx">HttpResponse.BinaryWrite method</a>. If you are writing the profile to a file, you can use the <a href="http://msdn.microsoft.com/en-us/library/system.io.file.writeallbytes.aspx">File.WriteAllBytes method</a>.*

I intend to leave this post up so anybody else who might having issues developing an MDM application with C# can find it.

If you notice any errors or have a better way of doing things, let me know and I will update the post accordingly.

Good luck!