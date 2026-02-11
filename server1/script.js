// CHANGE THIS later to your partner’s Server2 origin
const API_BASE = "http://127.0.0.1:3001";

const insertBtn = document.getElementById("insertBtn");
const submitBtn = document.getElementById("submitBtn");
const sqlBox = document.getElementById("sqlBox");

// modal elements
const modalBackdrop = document.getElementById("modalBackdrop");
const modalContent = document.getElementById("modalContent");
const modalCloseBtn = document.getElementById("modalCloseBtn");

function openModal(text) {
  modalContent.textContent = text;
  modalBackdrop.classList.add("open");
  modalBackdrop.setAttribute("aria-hidden", "false");
}

function closeModal() {
  modalBackdrop.classList.remove("open");
  modalBackdrop.setAttribute("aria-hidden", "true");
}

// Close modal: X button, click outside, ESC
modalCloseBtn.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

// POST → insert rows
insertBtn.addEventListener("click", async () => {
  try {
    await fetch(`${API_BASE}/insert`, { method: "POST" });
  } catch (err) {
    console.error("Insert failed:", err);
  }
});

// GET → run SELECT query (FOR NOW: mock result popup)
submitBtn.addEventListener("click", async () => {
  const sql = sqlBox.value.trim();
  if (!sql) return;

  // ✅ MOCK RESPONSE (for testing UI)
  const fake = {
    ok: true,
    query: sql,
    rows: [
      { patientId: 1, name: "Tom", age: 20 },
      { patientId: 2, name: "Jane", age: 31 }
    ]
  };

  openModal(JSON.stringify(fake, null, 2));

  // Later (real call), you will replace the mock above with:
  // const res = await fetch(`${API_BASE}/query?sql=${encodeURIComponent(sql)}`);
  // const text = await res.text(); // or res.json()
  // openModal(text);
});
