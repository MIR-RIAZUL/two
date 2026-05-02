function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getAuthToken() {
  return localStorage.getItem('lostFoundToken') || '';
}

function setAuthToken(token) {
  if (token) {
    localStorage.setItem('lostFoundToken', token);
  }
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getAuthToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  return response;
}

async function loadReports() {
  const response = await api('/api/reports');
  if (!response.ok) throw new Error('Could not load reports');
  return response.json();
}

async function loadMessages(conversationId) {
  const response = await api(`/api/messages?conversationId=${conversationId}`);
  if (!response.ok) throw new Error('Could not load messages');
  return response.json();
}

function reportCard(report) {
  const article = document.createElement('article');
  article.className = 'listing-card';
  article.innerHTML = `
    <div class="card-top">
      <span class="pill ${report.status.toLowerCase() === 'found' ? 'found' : 'lost'}">${escapeHtml(report.status)}</span>
      <span class="time">${escapeHtml(new Date(report.createdAt).toLocaleString())}</span>
    </div>
    <h3>${escapeHtml(report.title)}</h3>
    <p>${escapeHtml(report.description || 'No description provided.')}</p>
    <div class="card-meta">
      <span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(report.location)}</span>
      <span><i class="fa-solid fa-tags"></i> ${escapeHtml(report.category)}</span>
    </div>
    <a class="ghost-btn" href="#chat">Open details</a>
  `;
  return article;
}

async function init() {
  const form = document.querySelector('.report-form');
  const cardGrid = document.querySelector('.card-grid');
  const statusButtons = document.querySelectorAll('.segmented button');
  const loginForm = document.querySelector('#login-form');
  const registerForm = document.querySelector('#register-form');
  const messageForm = document.querySelector('#message-form');

  if (!form || !cardGrid) return;

  statusButtons.forEach((button) => {
    button.addEventListener('click', () => {
      statusButtons.forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
    });
  });

  try {
    const reports = await loadReports();
    cardGrid.innerHTML = '';
    reports.slice(0, 6).forEach((report) => cardGrid.appendChild(reportCard(report)));
  } catch (error) {
    console.error(error);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const statusButton = form.querySelector('.segmented .active');
    const inputs = form.querySelectorAll('input[type="text"]');
    const imageInput = form.querySelector('input[type="file"]');

    const payload = new FormData();
    payload.append('title', inputs[0].value.trim());
    payload.append('category', form.querySelector('select').value);
    payload.append('status', statusButton ? statusButton.textContent.trim() : 'Lost');
    payload.append('location', inputs[1].value.trim());
    payload.append('description', form.querySelector('textarea').value.trim());
    payload.append('reward', inputs[2].value.trim());

    if (imageInput?.files?.[0]) {
      payload.append('image', imageInput.files[0]);
    }

    try {
      const response = await api('/api/reports', {
        method: 'POST',
        body: payload
      });

      if (!response.ok) {
        alert('Please fill in title, category, and location.');
        return;
      }

      const created = await response.json();
      cardGrid.prepend(reportCard(created));
      form.reset();
      statusButtons.forEach((item) => item.classList.remove('active'));
      statusButtons[0]?.classList.add('active');
    } catch (error) {
      alert('Backend is not reachable yet. Start the server from the L-F-main folder.');
      console.error(error);
    }
  });

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(loginForm);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(formData.entries()))
      });

      const result = await response.json();
      if (!response.ok) {
        alert(result.error || 'Login failed');
        return;
      }

      setAuthToken(result.token);
      alert(`Logged in as ${result.user.name}`);
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(registerForm);
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(formData.entries()))
      });

      const result = await response.json();
      if (!response.ok) {
        alert(result.error || 'Registration failed');
        return;
      }

      setAuthToken(result.token);
      alert(`Registered as ${result.user.name}`);
    });
  }

  if (messageForm) {
    messageForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(messageForm);
      const payload = Object.fromEntries(formData.entries());
      const response = await api('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) {
        alert(result.error || 'Message failed');
        return;
      }

      const thread = document.querySelector('.notification-panel ul');
      if (thread) {
        const item = document.createElement('li');
        item.textContent = `${result.senderName}: ${result.body}`;
        thread.prepend(item);
      }
      messageForm.reset();
    });
  }
}

init();
