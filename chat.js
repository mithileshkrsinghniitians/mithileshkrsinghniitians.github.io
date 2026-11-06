// DE Lab Store: shared chat code for every page (P1: automatic invitations on real pages).
// Each page sets window.DE_PAGE before loading this file, e.g.
//   { page: "product", inviteVar: "pageType2", inviteValue: "product", inviteAfterSeconds: 30 }
// Salesforce invitation rules decide WHEN the invitation shows; this file decides WHAT TEXT it shows.

(function () {
  var DE = window.DE_PAGE || { page: "home" };
  // P2: site language comes from <html lang="..."> (en, fr, ...); the Omni flow picks the skill from it
  var siteLanguage = (document.documentElement.lang || "en").toLowerCase();
  var isFrench = siteLanguage.indexOf("fr") === 0;

  // Sent to the chat as hidden pre-chat when the chat opens (Phase 7)
  var pageContext = { pageType: DE.page, checkoutError: "false" };

  // Invitation custom variables. Setup won't let two conditions use the same variable,
  // so each condition has its own: (1) pageType = checkout AND (2) checkoutError = true,
  // (3) pageType2 = product, (4) pageType3 = contactus. Values must be strings.
  var inviteVars = { pageType: DE.page, checkoutError: "false", pageType2: "none", pageType3: "none" };

  var inviteText = isFrench ? {
    checkout:  "Un problème de paiement ? Un conseiller peut vous aider à finaliser votre commande.",
    product:   "Vous souhaitez en savoir plus sur le trench ? Demandez à un conseiller style.",
    contactus: "Bonjour, comment pouvons-nous vous aider ?"
  } : {
    checkout:  "Payment problem? An advisor can help you complete your order.",
    product:   "Would you like more information about the Trench coat? Ask a style advisor.",
    contactus: "Hello, how may we help you today?"
  };

  function log(msg) {
    var el = document.getElementById("log");
    if (!el) { return; }
    el.textContent += new Date().toLocaleTimeString() + "  " + msg + "\n";
    el.scrollTop = el.scrollHeight;
  }

  function sendInviteVars(reason) {
    if (!window.embeddedservice_bootstrap || !embeddedservice_bootstrap.invitationAPI) {
      log("invitationAPI not available");
      return;
    }
    embeddedservice_bootstrap.invitationAPI.setCustomVariables(inviteVars);
    log("Invitation variables sent (" + reason + "): " + JSON.stringify(inviteVars));
  }

  // Phase 7 lesson: send hidden pre-chat when the chat opens, not at page load
  function sendHiddenPrechat() {
    if (!window.embeddedservice_bootstrap || !embeddedservice_bootstrap.prechatAPI) { return; }
    try {
      embeddedservice_bootstrap.prechatAPI.removeHiddenPrechatFields(["Page_Context", "Checkout_Error", "Language"]);
      embeddedservice_bootstrap.prechatAPI.setHiddenPrechatFields({
        Page_Context: pageContext.pageType,
        Checkout_Error: pageContext.checkoutError,
        Language: siteLanguage
      });
      log("Hidden pre-chat sent: Page_Context=" + pageContext.pageType + ", Checkout_Error=" + pageContext.checkoutError + ", Language=" + siteLanguage);
    } catch (e) { log("Hidden pre-chat not set: " + e.message); }
  }

  // Called by the checkout page when the payment fails (a website event, no chat click)
  window.DE_checkoutError = function (code) {
    pageContext.checkoutError = "true";
    inviteVars.checkoutError = "true";
    log("Checkout error event: " + code);
    sendInviteVars("checkout error");
  };

  // Our own invitation box ("Use Custom Component" is on, so Salesforce draws nothing itself)
  function showMyInvite() {
    var key = pageContext.checkoutError === "true" ? "checkout" : pageContext.pageType;
    var text = inviteText[key];
    if (!text) { log("Invitation shown by Salesforce, but no text for page " + key); return; }
    document.getElementById("myInviteText").textContent = text;
    document.getElementById("myInvite").style.display = "block";
    log("Invitation shown automatically: " + text);
  }
  window.DE_acceptInvite = function () {
    document.getElementById("myInvite").style.display = "none";
    log("Invitation accepted - opening chat");
    sendHiddenPrechat();
    embeddedservice_bootstrap.utilAPI.launchChat()
      .catch(function (e) { log("launchChat failed: " + e); });
  };
  window.DE_dismissInvite = function () {
    document.getElementById("myInvite").style.display = "none";
    log("Invitation dismissed");
  };

  // The widget fires Ready again when a chat ends; set up the page only once per page load
  var readyDone = false;
  function onReady() {
    if (readyDone) { log("Ready again (chat ended) - page setup already done"); return; }
    readyDone = true;
    sendInviteVars("page load");
    // Pages such as product / contact us allow their invitation only after some time on the page
    if (DE.inviteVar) {
      var wait = DE.inviteAfterSeconds || 0;
      log("Invitation for this page allowed after " + wait + " s on the page");
      setTimeout(function () {
        inviteVars[DE.inviteVar] = DE.inviteValue;
        sendInviteVars(wait + " s on page");
      }, wait * 1000);
    }
  }

  window.addEventListener("onEmbeddedMessagingInvitationShown", showMyInvite);
  ["onEmbeddedMessagingReady",
   "onEmbeddedMessagingConversationStarted",
   "onEmbeddedMessagingConversationClosed",
   "onEmbeddedMessagingInvitationShown",
   "onEmbeddedMessagingWindowMaximized"].forEach(function (evt) {
    window.addEventListener(evt, function () {
      log("EVENT " + evt);
      if (evt === "onEmbeddedMessagingReady") { onReady(); }
      if (evt === "onEmbeddedMessagingWindowMaximized") { sendHiddenPrechat(); }
      // P2 T4 finding: "Continue conversation" after a chat ended can start a NEW conversation
      // in the open window, with no hidden pre-chat (so no Language). Re-send it for the next one.
      if (evt === "onEmbeddedMessagingConversationClosed") { sendHiddenPrechat(); }
    });
  });

  // Salesforce Enhanced Chat v2 code snippet (loaded the same way on every page)
  window.initEmbeddedMessaging = function () {
    try {
      // Widget UI stays English: the deployment has only en_US set up (the routing uses the Language field instead)
      embeddedservice_bootstrap.settings.language = "en_US";
      // Lab only: print the widget's internal logs (invitation decisions) to the browser console
      embeddedservice_bootstrap.settings.devMode = true;
      embeddedservice_bootstrap.init(
        "00Dg800000MXwzv",
        "DE_Lab_Web_Chat",
        "https://orgfarm-46a2e87dcd-dev-ed.develop.my.site.com/ESWDELabWebCha1793226077623",
        { scrt2URL: "https://orgfarm-46a2e87dcd-dev-ed.develop.my.salesforce-scrt.com" }
      );
      log("Page: " + DE.page + " (language " + siteLanguage + ") - chat init called");
    } catch (err) {
      console.error("Error loading Embedded Messaging: ", err);
      log("init error: " + err.message);
    }
  };
  var s = document.createElement("script");
  s.src = "https://orgfarm-46a2e87dcd-dev-ed.develop.my.site.com/ESWDELabWebCha1793226077623/assets/js/bootstrap.min.js";
  s.onload = window.initEmbeddedMessaging;
  document.head.appendChild(s);
})();
