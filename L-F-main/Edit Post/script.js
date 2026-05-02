const toast = document.getElementById("toast");

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1200);
}

function handleUpdate() {
  showToast("Changes saved");
  setTimeout(() => {
    location.href = "../Post Details/index.html";
  }, 700);
}

function toggleFavorite(button) {
  const icon = button.querySelector("i");
  icon?.classList.toggle("far");
  icon?.classList.toggle("fas");

  const label = button.querySelector("span");
  if (label) label.textContent = icon?.classList.contains("fas") ? "Saved" : "Add to Favorites";
}

function confirmDelete() {
  if (window.confirm("Delete this post?")) {
    showToast("Post deleted");
    setTimeout(() => {
      location.href = "../Browse Listings/index.html";
    }, 700);
  }
}
