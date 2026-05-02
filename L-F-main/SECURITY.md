# Security Guidelines

## Overview

This document outlines the security features and best practices implemented in the Lost & Found platform.

## Security Measures Implemented

### 1. Authentication & Authorization

**JWT Tokens**
- All protected endpoints require valid JWT tokens
- Tokens expire after 7 days
- Tokens include user ID, email, and name claims
- Invalid/expired tokens return 401 Unauthorized

```javascript
// Example protected endpoint usage
const token = localStorage.getItem('lostFoundToken');
const headers = { 'Authorization': `Bearer ${token}` };
```

**Password Security**
- Passwords hashed using bcryptjs with salt rounds (10)
- Minimum 6 characters required
- Never stored in plain text
- Compared using secure comparison function

### 2. Input Validation

**Server-Side Validation**
- All inputs trimmed and validated
- Email format validated with regex
- Required fields checked before processing
- File uploads filtered by MIME type

**Client-Side Validation**
- HTML5 input attributes (required, type, minlength)
- Form submission prevented on invalid input
- User-friendly error messages

### 3. SQL Injection Prevention

**Parameterized Queries**
```javascript
// SAFE - Parameterized query
const user = getOne('SELECT * FROM users WHERE email = ?', [email]);

// NOT SAFE - String concatenation (NOT USED)
const unsafe = getOne(`SELECT * FROM users WHERE email = '${email}'`);
```

All database queries use parameter binding to prevent SQL injection attacks.

### 4. XSS (Cross-Site Scripting) Protection

**HTML Escaping**
```javascript
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
```

All user-generated content displayed on the frontend is HTML-escaped to prevent script injection.

### 5. File Upload Security

**Validation**
- MIME type filtering (images only: JPEG, PNG, GIF, WebP)
- File size limit: 5MB
- Filenames sanitized (special characters removed)
- Files stored outside web root if possible

```javascript
fileFilter: (_req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
}
```

### 6. CORS (Cross-Origin Resource Sharing)

**Configuration**
```javascript
app.use(cors({
  origin: '*',  // Configure as needed
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

Restricts which domains can access the API. Configure `origin` to specific domain in production.

### 7. Rate Limiting (Recommended Enhancement)

**Not yet implemented** - Add express-rate-limit:
```bash
npm install express-rate-limit
```

### 8. HTTP Headers (Recommended Enhancement)

**Helmet.js** recommended:
```bash
npm install helmet
```

```javascript
app.use(helmet());
```

Adds security headers like:
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- etc.

## Best Practices for Developers

### 1. Database Operations

✅ Always use parameterized queries
```javascript
const user = getOne('SELECT * FROM users WHERE email = ?', [email]);
```

❌ Never concatenate user input
```javascript
// DON'T DO THIS
const user = getOne(`SELECT * FROM users WHERE email = '${email}'`);
```

### 2. API Responses

✅ Never expose sensitive data
```javascript
return { id: user.id, name: user.name, email: user.email };
```

❌ Don't include passwords or hashes
```javascript
// DON'T DO THIS
return { ...user, password_hash: user.password_hash };
```

### 3. Error Handling

✅ Provide generic error messages to users
```javascript
return res.status(401).json({ error: 'Invalid email or password.' });
```

❌ Don't expose system details
```javascript
// DON'T DO THIS
return res.status(500).json({ error: err.message, stack: err.stack });
```

### 4. Logging

✅ Log security events
```javascript
log(`User login attempt: ${email}`);
log(`Failed password comparison for user: ${email}`);
```

❌ Don't log sensitive information
```javascript
// DON'T DO THIS
console.log(`User password: ${password}`);
```

### 5. Frontend Security

✅ Always escape user output
```javascript
const escaped = escapeHtml(userInput);
element.innerHTML = escaped;
```

❌ Never use innerHTML with untrusted content
```javascript
// DON'T DO THIS
element.innerHTML = userInput;
```

## Environment Variables

Create a `.env` file (or set environment variables):

```bash
PORT=3000
JWT_SECRET=your-secret-key-here
NODE_ENV=production
DEBUG=false
```

**Never commit `.env` file to version control!**

## Security Checklist for Production

- [ ] Set strong JWT_SECRET
- [ ] Update CORS origin to specific domain
- [ ] Enable HTTPS/TLS
- [ ] Add rate limiting
- [ ] Add Helmet.js headers
- [ ] Enable database encryption
- [ ] Set NODE_ENV=production
- [ ] Configure proper logging
- [ ] Regular security audits
- [ ] Keep dependencies updated
- [ ] Add two-factor authentication
- [ ] Implement password reset email verification

## Reporting Security Issues

If you discover a security vulnerability, please email: security@lostfound.local

Please do NOT post security issues publicly. Give maintainers time to fix before disclosure.

## Compliance

This application follows OWASP Top 10 security best practices:

1. ✅ Broken Access Control - JWT authentication
2. ✅ Cryptographic Failures - bcryptjs hashing
3. ✅ Injection - Parameterized queries
4. ✅ Insecure Design - Input validation
5. ✅ Security Misconfiguration - Environment variables
6. ✅ Vulnerable Components - Regular updates
7. ✅ Identification and Authentication - Secure tokens
8. ✅ Data Integrity Failures - CORS configured
9. ✅ Logging and Monitoring - Debug logging
10. ✅ SSRF - N/A for this application

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/nodejs-security/)
- [Express Security](https://expressjs.com/en/advanced/best-practice-security.html)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

**Last Updated**: May 3, 2026
