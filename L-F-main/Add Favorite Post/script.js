const favoritesGrid = document.getElementById("favoritesGrid");
const totalCount = document.getElementById("total-count");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const toast = document.getElementById("toast");

function updateTotal() {
  const count = favoritesGrid?.querySelectorAll(".modern-card").length || 0;
  if (totalCount) totalCount.textContent = String(count).padStart(2, "0");
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1200);
}

function removeFromFav(button) {
  button.closest(".modern-card")?.remove();
  updateTotal();
  showToast("Removed from favorites");
}

function filterFavorites() {
  const term = searchInput?.value.toLowerCase() || "";
  const category = categoryFilter?.value || "all";
  favoritesGrid?.querySelectorAll(".modern-card").forEach((card) => {
    const text = card.textContent.toLowerCase();
    const categoryMatch = category === "all" || card.dataset.category === category;
    card.style.display = text.includes(term) && categoryMatch ? "" : "none";
  });
}

searchInput?.addEventListener("input", filterFavorites);
categoryFilter?.addEventListener("change", filterFavorites);
updateTotal();
