// 活動報名頁的程式：檢查報名資料、組出確認訊息、把表單接上畫面。
// 名額與人數上限來自 event-config.js（EVENT_CONFIG），不要寫死在這裡。

// 檢查一筆報名資料。回傳錯誤訊息的陣列；沒有錯誤就是空陣列。
function validateSignup(data, config) {
  var errors = [];
  var name = String(data.name || "").trim();
  var email = String(data.email || "").trim();
  var people = Number(data.people);

  if (name === "") {
    errors.push("請填寫姓名");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Email 格式不正確");
  }
  if (!Number.isInteger(people) || people < 1) {
    errors.push("報名人數至少 1 人");
  } else if (people > config.maxPerSignup) {
    errors.push("每筆報名最多 " + config.maxPerSignup + " 人");
  }
  return errors;
}

// 組出送出後的確認訊息（純文字）。
function buildConfirmation(data, config) {
  var name = String(data.name || "").trim();
  var people = Number(data.people);
  return (
    name + "，報名成功！\n" +
    "活動：" + config.name + "\n" +
    "人數：" + people + " 人\n" +
    "確認信會寄到 " + String(data.email || "").trim()
  );
}

// 把表單接上畫面（只在瀏覽器裡執行；check.mjs 用 Node.js 載入時沒有 document）。
if (typeof document !== "undefined") {
  var form = document.getElementById("signup-form");
  var errorBox = document.getElementById("form-error");
  var confirmation = document.getElementById("confirmation");

  document.getElementById("event-name").textContent = EVENT_CONFIG.name;
  document.getElementById("event-info").textContent =
    EVENT_CONFIG.date + "｜" + EVENT_CONFIG.place + "｜名額 " + EVENT_CONFIG.capacity + " 人";
  document.getElementById("people").max = EVENT_CONFIG.maxPerSignup;

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var data = {
      name: form.elements.name.value,
      email: form.elements.email.value,
      people: form.elements.people.value,
    };
    var errors = validateSignup(data, EVENT_CONFIG);
    if (errors.length > 0) {
      errorBox.textContent = errors.join("、");
      errorBox.hidden = false;
      confirmation.hidden = true;
      return;
    }
    errorBox.hidden = true;
    confirmation.textContent = buildConfirmation(data, EVENT_CONFIG);
    confirmation.hidden = false;
  });
}
