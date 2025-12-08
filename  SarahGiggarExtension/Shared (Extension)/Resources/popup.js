// popup.js
const saveButton = document.getElementById("saveButton");
const messageEl = document.getElementById("message");

function setMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.style.color = isError ? "red" : "inherit";
}

saveButton.addEventListener("click", async () => {
  setMessage("Saving...");

  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url) {
      setMessage("Could not find the current tab URL.", true);
      return;
    }

    const urlToSave = tab.url;

    const response = await fetch("https://sarahgiggar.com/api/wardrobe/quick-add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({ url: urlToSave })
    });

    if (!response.ok) {
      setMessage("Could not save item (HTTP " + response.status + ").", true);
      return;
    }

    setMessage("Saved to Sarah’s wardrobe ✨");
    setTimeout(() => window.close(), 1000);
  } catch (err) {
    console.error("Error saving wardrobe item:", err);
    setMessage("Error talking to sarahgiggar.com.", true);
  }
});
