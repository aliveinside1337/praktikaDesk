const state = {
  activeTab: "contacts",
  contacts: [],
  sortBy: "name",
  search: "",
  category: "Все категории",
  settings: { push_alerts: true, auto_backup: true },
  profile: { name: "", email: "", role: "" },
  editingId: null,
};

const sortOptions = [
  { key: "name", label: "Имя" },
  { key: "phone", label: "Телефон" },
  { key: "email", label: "Email" },
  { key: "category", label: "Категория" },
  { key: "date", label: "Дата" },
];

function field(form, name) {
  return form.elements.namedItem(name);
}

function showError(text) {
  const error = document.getElementById("error");
  error.textContent = text;
  error.classList.remove("hidden");
}

function clearError() {
  const error = document.getElementById("error");
  error.textContent = "";
  error.classList.add("hidden");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Ошибка API");
  }
  if (response.status === 204) return null;
  return response.json();
}

function filteredContacts() {
  const search = state.search.toLowerCase().trim();
  return state.contacts
    .filter((c) => (state.category === "Все категории" ? true : c.category === state.category))
    .filter((c) => {
      if (!search) return true;
      return `${c.name} ${c.phone} ${c.email} ${c.address}`.toLowerCase().includes(search);
    })
    .sort((a, b) => {
      if (state.sortBy === "date") return b.created_at.localeCompare(a.created_at);
      if (state.sortBy === "category") return a.category.localeCompare(b.category, "ru");
      return a[state.sortBy].localeCompare(b[state.sortBy], "ru");
    });
}

function renderSortButtons() {
  const root = document.getElementById("sort-row");
  root.innerHTML = "<small>Сортировка:</small>";
  sortOptions.forEach((item) => {
    const btn = document.createElement("button");
    btn.className = item.key === state.sortBy ? "btn btn-purple" : "btn btn-light";
    btn.textContent = item.label;
    btn.onclick = () => {
      state.sortBy = item.key;
      render();
    };
    root.appendChild(btn);
  });
}

function renderContacts() {
  const root = document.getElementById("contacts-groups");
  const list = filteredContacts();
  const byCategory = {};

  list.forEach((c) => {
    if (!byCategory[c.category]) byCategory[c.category] = [];
    byCategory[c.category].push(c);
  });

  root.innerHTML = "";
  if (Object.keys(byCategory).length === 0) {
    root.innerHTML = "<p>Контакты не найдены</p>";
    return;
  }

  Object.entries(byCategory).forEach(([category, items]) => {
    const block = document.createElement("div");
    block.className = "group";
    block.innerHTML = `<h3 class="group-title">${category} (${items.length})</h3><div class="grid"></div>`;
    const grid = block.querySelector(".grid");

    items.forEach((contact) => {
      const item = document.createElement("article");
      item.className = "contact";
      item.innerHTML = `
        <h3>${contact.name}</h3>
        <span class="chip">${contact.category}</span>
        <p>${contact.phone}</p>
        <p>${contact.email}</p>
        <p>${contact.address}</p>
        <div class="row-gap">
          <button class="btn btn-purple">Редактировать</button>
          <button class="btn btn-red">Удалить</button>
        </div>
      `;

      const [editBtn, deleteBtn] = item.querySelectorAll("button");
      editBtn.onclick = () => openModal(contact);
      deleteBtn.onclick = async () => {
        try {
          await api(`/api/contacts/${contact.id}`, { method: "DELETE" });
          await loadContacts();
        } catch {
          showError("Не удалось удалить контакт");
        }
      };

      grid.appendChild(item);
    });

    root.appendChild(block);
  });
}

function renderTabs() {
  ["contacts", "import", "export", "settings", "profile"].forEach((tab) => {
    const panel = document.getElementById(`tab-${tab}`);
    const isActive = state.activeTab === tab;

    if (isActive) {
      panel.classList.remove("hidden");
      panel.classList.remove("tab-animate");
      void panel.offsetWidth;
      panel.classList.add("tab-animate");
    } else {
      panel.classList.add("hidden");
      panel.classList.remove("tab-animate");
    }
  });

  document.querySelectorAll(".menu-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.tab === state.activeTab);
  });
}

function renderExport() {
  document.getElementById("export-preview").textContent = JSON.stringify(state.contacts, null, 2);
}

function render() {
  document.getElementById("contacts-count").textContent = `Всего контактов: ${state.contacts.length}`;
  renderTabs();
  renderSortButtons();
  renderContacts();
  renderExport();
}

async function loadContacts() {
  state.contacts = await api("/api/contacts");
  render();
}

async function loadMeta() {
  state.settings = await api("/api/settings");
  state.profile = await api("/api/profile");

  document.getElementById("push-alerts").checked = state.settings.push_alerts;
  document.getElementById("auto-backup").checked = state.settings.auto_backup;
  document.getElementById("profile-name").value = state.profile.name;
  document.getElementById("profile-email").value = state.profile.email;
  document.getElementById("profile-role").value = state.profile.role;
}

function openMenu() {
  const menu = document.getElementById("side-menu");
  const overlay = document.getElementById("overlay");

  menu.classList.remove("hidden");
  overlay.classList.remove("hidden");
  menu.classList.remove("menu-animate");
  overlay.classList.remove("overlay-animate");

  void menu.offsetWidth;
  menu.classList.add("menu-animate");
  overlay.classList.add("overlay-animate");
}

function closeMenu() {
  const menu = document.getElementById("side-menu");
  const overlay = document.getElementById("overlay");

  menu.classList.add("hidden");
  overlay.classList.add("hidden");
  menu.classList.remove("menu-animate");
  overlay.classList.remove("overlay-animate");
}

function openModal(contact = null) {
  state.editingId = contact ? contact.id : null;
  document.getElementById("modal-title").textContent = contact ? "Редактировать контакт" : "Добавить контакт";
  document.getElementById("submit-modal").textContent = contact ? "Сохранить" : "Добавить";

  const form = document.getElementById("contact-form");
  field(form, "name").value = contact?.name || "";
  field(form, "phone").value = contact?.phone || "";
  field(form, "email").value = contact?.email || "";
  field(form, "address").value = contact?.address || "";
  field(form, "category").value = contact?.category || "Работа";

  const modal = document.getElementById("modal");
  const modalCard = document.querySelector(".modal-card");

  modal.classList.remove("hidden");
  modal.classList.remove("modal-animate");
  modalCard.classList.remove("modal-card-animate");
  void modal.offsetWidth;
  modal.classList.add("modal-animate");
  modalCard.classList.add("modal-card-animate");
}

function closeModal() {
  const modal = document.getElementById("modal");
  const modalCard = document.querySelector(".modal-card");

  modal.classList.add("hidden");
  modal.classList.remove("modal-animate");
  modalCard.classList.remove("modal-card-animate");
  state.editingId = null;
}

function bindEvents() {
  document.getElementById("open-menu").onclick = openMenu;
  document.getElementById("close-menu").onclick = closeMenu;
  document.getElementById("overlay").onclick = closeMenu;
  document.getElementById("open-add").onclick = () => openModal(null);
  document.getElementById("close-modal").onclick = closeModal;
  document.getElementById("cancel-modal").onclick = closeModal;

  document.getElementById("go-import").onclick = () => {
    state.activeTab = "import";
    render();
  };
  document.getElementById("go-export").onclick = () => {
    state.activeTab = "export";
    render();
  };

  document.querySelectorAll(".menu-item").forEach((item) => {
    item.onclick = () => {
      state.activeTab = item.dataset.tab;
      closeMenu();
      render();
    };
  });

  document.getElementById("search").oninput = (e) => {
    state.search = e.target.value;
    render();
  };
  document.getElementById("category-filter").onchange = (e) => {
    state.category = e.target.value;
    render();
  };

  document.getElementById("contact-form").onsubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = {
      name: field(form, "name").value,
      phone: field(form, "phone").value,
      email: field(form, "email").value,
      address: field(form, "address").value,
      category: field(form, "category").value,
    };
    try {
      if (state.editingId) {
        await api(`/api/contacts/${state.editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await api("/api/contacts", { method: "POST", body: JSON.stringify(payload) });
      }
      closeModal();
      await loadContacts();
      clearError();
    } catch {
      showError("Не удалось сохранить контакт");
    }
  };

  document.getElementById("import-btn").onclick = async () => {
    try {
      const payload = JSON.parse(document.getElementById("import-text").value);
      if (!Array.isArray(payload)) throw new Error();
      await api("/api/contacts/import", { method: "POST", body: JSON.stringify(payload) });
      state.activeTab = "contacts";
      await loadContacts();
      clearError();
    } catch {
      showError("Неверный JSON для импорта");
    }
  };

  document.getElementById("clear-import").onclick = () => {
    document.getElementById("import-text").value = "[";
  };

  document.getElementById("download-export").onclick = async () => {
    try {
      const data = await api("/api/contacts/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "contacts-export.json";
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      showError("Ошибка экспорта");
    }
  };

  document.getElementById("save-settings").onclick = async () => {
    const payload = {
      push_alerts: document.getElementById("push-alerts").checked,
      auto_backup: document.getElementById("auto-backup").checked,
    };
    try {
      state.settings = await api("/api/settings", { method: "PUT", body: JSON.stringify(payload) });
      clearError();
    } catch {
      showError("Не удалось сохранить настройки");
    }
  };

  document.getElementById("save-profile").onclick = async () => {
    const payload = {
      name: document.getElementById("profile-name").value,
      email: document.getElementById("profile-email").value,
      role: document.getElementById("profile-role").value,
    };
    try {
      state.profile = await api("/api/profile", { method: "PUT", body: JSON.stringify(payload) });
      clearError();
    } catch {
      showError("Не удалось сохранить профиль");
    }
  };
}

async function init() {
  bindEvents();
  try {
    await Promise.all([loadContacts(), loadMeta()]);
    clearError();
  } catch {
    showError("Backend недоступен или не запущен");
  }
}

init();
