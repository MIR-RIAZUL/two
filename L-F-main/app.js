// Utility: Escape HTML to prevent XSS attacks
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Auth token management
function getAuthToken() {
  return localStorage.getItem('lostFoundToken') || '';
}

function setAuthToken(token) {
  if (token) {
    localStorage.setItem('lostFoundToken', token);
  } else {
    localStorage.removeItem('lostFoundToken');
  }
}

function clearAuthToken() {
  localStorage.removeItem('lostFoundToken');
}

// API helper with auth
async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getAuthToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(path, {
      ...options,
      headers
    });

    return response;
  } catch (err) {
    console.error('API call failed:', err);
    throw err;
  }
}

// Load all reports from backend
async function loadReports() {
  try {
    const response = await api('/api/reports');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Failed to load reports:', error);
    return [];
  }
}

// Load messages for a specific conversation
async function loadMessages(conversationId) {
  try {
    const response = await api(`/api/messages?conversationId=${conversationId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Failed to load messages:', error);
    return [];
  }
}

// Create a report card element
function reportCard(report) {
  const article = document.createElement('article');
  article.className = 'listing-card';
  
  const statusClass = report.status?.toLowerCase() === 'found' ? 'found' : 'lost';
  const createdDate = new Date(report.createdAt || Date.now()).toLocaleString();
  
  article.innerHTML = `
    <div class="card-top">
      <span class="pill ${statusClass}">${escapeHtml(report.status || 'Unknown')}</span>
      <span class="time">${escapeHtml(createdDate)}</span>
    </div>
    <h3>${escapeHtml(report.title || 'Untitled')}</h3>
    <p>${escapeHtml(report.description || 'No description provided.')}</p>
    <div class="card-meta">
      <span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(report.location || 'Location unknown')}</span>
      <span><i class="fa-solid fa-tags"></i> ${escapeHtml(report.category || 'Other')}</span>
    </div>
    <a class="ghost-btn" href="#chat">Open details</a>
  `;
  
  return article;
}

// Initialize page functionality
async function init() {
  const form = document.querySelector('.report-form');
  const cardGrid = document.querySelector('.card-grid');
  const statusButtons = document.querySelectorAll('.segmented button');
  const loginForm = document.querySelector('#login-form');
  const registerForm = document.querySelector('#register-form');
  const messageForm = document.querySelector('#message-form');

  // Handle status button toggling
  if (statusButtons.length > 0) {
    statusButtons.forEach((button) => {
      button.addEventListener('click', () => {
        statusButtons.forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
      });
    });
    // Set first as active by default
    statusButtons[0]?.classList.add('active');
  }

  // Load and display initial reports
  if (cardGrid) {
    try {
      const reports = await loadReports();
      cardGrid.innerHTML = '';
      const displayReports = Array.isArray(reports) ? reports.slice(0, 6) : [];
      displayReports.forEach((report) => {
        cardGrid.appendChild(reportCard(report));
      });
    } catch (error) {
      console.error('Failed to load initial reports:', error);
      cardGrid.innerHTML = '<p style="color: red;">Failed to load reports. Please refresh the page.</p>';
    }
  }

  // Handle report form submission
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      const statusButton = form.querySelector('.segmented .active');
      const inputs = form.querySelectorAll('input[type="text"]');
      const selectElement = form.querySelector('select');
      const textareaElement = form.querySelector('textarea');
      const imageInput = form.querySelector('input[type="file"]');

      if (!inputs[0]?.value.trim() || !selectElement?.value || !inputs[1]?.value.trim()) {
        alert('Please fill in title, category, and location.');
        return;
      }

      const payload = new FormData();
      payload.append('title', inputs[0].value.trim());
      payload.append('category', selectElement.value);
      payload.append('status', statusButton ? statusButton.textContent.trim() : 'Lost');
      payload.append('location', inputs[1].value.trim());
      payload.append('description', textareaElement?.value.trim() || '');
      payload.append('reward', inputs[2]?.value.trim() || '');

      if (imageInput?.files?.[0]) {
        payload.append('image', imageInput.files[0]);
      }

      try {
        const response = await api('/api/reports', {
          method: 'POST',
          body: payload
        });

        if (!response.ok) {
          const error = await response.json();
          alert(error.error || 'Please fill in title, category, and location.');
          return;
        }

        const created = await response.json();
        if (cardGrid) {
          cardGrid.prepend(reportCard(created));
        }
        form.reset();
        statusButtons.forEach((item) => item.classList.remove('active'));
        statusButtons[0]?.classList.add('active');
        alert('Report created successfully!');
      } catch (error) {
        console.error('Create report error:', error);
        alert('Failed to create report. Is the backend server running?');
      }
    });
  }

  // Handle login form
  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      const formData = new FormData(loginForm);
      const email = formData.get('email')?.trim();
      const password = formData.get('password');

      if (!email || !password) {
        alert('Please enter email and password.');
        return;
      }

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const result = await response.json();
        if (!response.ok) {
          alert(result.error || 'Login failed');
          return;
        }

        setAuthToken(result.token);
        alert(`Welcome back, ${escapeHtml(result.user.name)}!`);
        loginForm.reset();
        // Redirect to dashboard after successful login
        window.location.href = '/DashBoard/index.html';
      } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
      }
    });
  }

  // Handle registration form
  if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      const formData = new FormData(registerForm);
      const name = formData.get('name')?.trim();
      const email = formData.get('email')?.trim();
      const password = formData.get('password');

      if (!name || !email || !password || password.length < 6) {
        alert('Please provide a name, email, and a 6+ character password.');
        return;
      }

      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });

        const result = await response.json();
        if (!response.ok) {
          alert(result.error || 'Registration failed');
          return;
        }

        setAuthToken(result.token);
        alert(`Welcome, ${escapeHtml(result.user.name)}!`);
        registerForm.reset();
        // Redirect to dashboard after successful registration
        window.location.href = '/DashBoard/index.html';
      } catch (error) {
        console.error('Register error:', error);
        alert('Registration failed. Please try again.');
      }
    });
  }

  // Handle message form
  if (messageForm) {
    messageForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      const formData = new FormData(messageForm);
      const payload = Object.fromEntries(formData.entries());

      if (!payload.body?.trim() || !payload.senderName?.trim()) {
        alert('Please enter a message and sender name.');
        return;
      }

      try {
        const response = await api('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok) {
          alert(result.error || 'Failed to send message');
          return;
        }

        const thread = document.querySelector('.notification-panel ul');
        if (thread) {
          const item = document.createElement('li');
          item.textContent = `${escapeHtml(result.senderName)}: ${escapeHtml(result.body)}`;
          thread.prepend(item);
        }
        messageForm.reset();
        alert('Message sent!');
      } catch (error) {
        console.error('Message error:', error);
        alert('Failed to send message.');
      }
    });
  }
}

init();
