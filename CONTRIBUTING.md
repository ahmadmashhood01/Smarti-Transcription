# Contributing to Smarti Transcription

First off, thank you for considering contributing to Smarti Transcription! 🎉

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Submitting Changes](#submitting-changes)
- [Style Guidelines](#style-guidelines)

## 📜 Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## 🚀 Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Smarti-Transcription.git
   cd Smarti-Transcription
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/ahmadmashhood01/Smarti-Transcription.git
   ```

## 💻 Development Setup

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Firebase CLI
- Git

### Installation

```bash
# Install frontend dependencies
cd frontend && npm install && cd ..

# Install backend dependencies
cd backend && npm install && cd ..

# Install cloud functions dependencies
cd cloud-functions && npm install && cd ..

# Copy environment file
cp env.example .env
# Edit .env with your development credentials

# Start development servers
docker-compose up
```

### Running Tests

```bash
# Backend tests
cd backend && npm test

# Frontend lint
cd frontend && npm run lint

# Backend lint
cd backend && npm run lint
```

## ✏️ Making Changes

1. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes** following our [style guidelines](#style-guidelines)

3. **Test your changes** thoroughly

4. **Commit your changes** with a descriptive commit message:
   ```bash
   git commit -m "feat: add new transcription feature"
   # or
   git commit -m "fix: resolve audio upload issue"
   ```

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Type | Description |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting, etc.) |
| `refactor` | Code refactoring |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks |

## 📤 Submitting Changes

1. **Push your branch** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a Pull Request** from your fork to the main repository

3. **Fill out the PR template** completely

4. **Wait for review** - we'll get back to you as soon as possible!

## 🎨 Style Guidelines

### JavaScript/React

- Use ES6+ features
- Use functional components with hooks
- Follow ESLint configuration
- Use meaningful variable and function names
- Add comments for complex logic

```javascript
// ✅ Good
const handleFileUpload = async (files) => {
  // Validate file types before processing
  const validFiles = files.filter(isValidAudioFile);
  await processFiles(validFiles);
};

// ❌ Bad
const h = async (f) => {
  const v = f.filter(x);
  await p(v);
};
```

### CSS/Tailwind

- Use Tailwind utility classes
- Follow mobile-first approach
- Group related utilities together

```jsx
// ✅ Good
<button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
  Upload
</button>
```

### File Organization

```
src/
├── components/     # React components
├── services/       # API and Firebase services
├── hooks/          # Custom React hooks
├── utils/          # Utility functions
└── types/          # TypeScript types (if applicable)
```

## 🙏 Thank You!

Your contributions make this project better for everyone. Thank you for taking the time to contribute!

---

If you have any questions, feel free to open an issue or reach out to [@ahmadmashhood01](https://github.com/ahmadmashhood01).

