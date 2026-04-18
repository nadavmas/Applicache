(function () {
  if (window.location.hostname !== "www.linkedin.com") {
    return;
  }

  console.log("AppliCache Content Script active on LinkedIn");

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.action !== "GET_JOB_DATA") {
      return false;
    }

    const payload = {
      title: document.title,
      url: window.location.href,
      description: document.body.innerText.substring(0, 5000),
    };
    sendResponse(payload);
    return false;
  });
})();
