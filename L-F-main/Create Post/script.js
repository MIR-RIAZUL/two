const titleInput = document.getElementById("title");
const descInput = document.getElementById("desc");
const charCount = document.getElementById("charCount");
const toast = document.getElementById("toast");
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const previewGrid = document.getElementById("previewGrid");

if (descInput && charCount) {
  descInput.addEventListener("input", () => {
    charCount.textContent = `${descInput.value.length} / 500`;
  });
}

if (dropZone && fileInput) {
  dropZone.addEventListener("click", () => fileInput.click());
}

if (fileInput && previewGrid) {
  fileInput.addEventListener("change", () => {
    previewGrid.innerHTML = "";
    [...fileInput.files].slice(0, 5).forEach((file) => {
      const item = document.createElement("div");
      item.textContent = file.name;
      item.style.cssText = "margin-top:10px;padding:10px;border:1px solid #e2e8f0;border-radius:10px;font-size:12px;background:#fff;";
      previewGrid.appendChild(item);
    });
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1200);
}

function resetForm() {
  document.querySelectorAll("input, textarea").forEach((field) => {
    if (field.type !== "radio" && field.type !== "file") field.value = "";
  });
  if (charCount) charCount.textContent = "0 / 500";
  if (previewGrid) previewGrid.innerHTML = "";
  showToast("Draft cleared");
}

function handlePost() {
  const title = titleInput?.value.trim() || "New Lost & Found Item";
  localStorage.setItem("lf_latest_title", title);
  showToast("Post submitted");
  setTimeout(() => {
    location.href = "../Post Details/index.html";
  }, 700);
}
