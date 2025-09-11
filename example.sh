#!/bin/bash

# Example usage script for the Staged Git Commit Bot

echo "🤖 Staged Git Commit Bot - Example Usage"
echo "========================================"

# Create example directories
echo "Creating test directories..."
mkdir -p example-source example-target

# Initialize target as git repo
cd example-target
git init
echo "# Test Repository" > README.md
git add README.md
git commit -m "Initial commit"
cd ..

# Create example source project
echo "Creating example source project..."
cd example-source

# Create a simple React-like project structure
mkdir -p src/{components,pages,utils,hooks} public tests docs

# Package.json
cat > package.json << 'EOF'
{
  "name": "example-app",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test"
  }
}
EOF

# .gitignore
cat > .gitignore << 'EOF'
node_modules/
.env*
dist/
build/
.cache/
*.log
EOF

# Source files
cat > src/App.js << 'EOF'
import React from 'react';
import Header from './components/Header';
import Footer from './components/Footer';

function App() {
  return (
    <div className="App">
      <Header />
      <main>
        <h1>Welcome to Example App</h1>
      </main>
      <Footer />
    </div>
  );
}

export default App;
EOF

cat > src/components/Header.js << 'EOF'
import React from 'react';

function Header() {
  return (
    <header>
      <nav>
        <h2>Example App</h2>
      </nav>
    </header>
  );
}

export default Header;
EOF

cat > src/components/Footer.js << 'EOF'
import React from 'react';

function Footer() {
  return (
    <footer>
      <p>&copy; 2025 Example App</p>
    </footer>
  );
}

export default Footer;
EOF

cat > src/utils/helpers.js << 'EOF'
export function formatDate(date) {
  return new Date(date).toLocaleDateString();
}

export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
EOF

cat > tests/App.test.js << 'EOF'
import { render, screen } from '@testing-library/react';
import App from '../src/App';

test('renders welcome message', () => {
  render(<App />);
  const welcomeElement = screen.getByText(/welcome to example app/i);
  expect(welcomeElement).toBeInTheDocument();
});
EOF

cat > README.md << 'EOF'
# Example App

A simple React application for testing the Staged Git Commit Bot.

## Features

- React components
- Utility functions  
- Test suite
- Modern build setup

## Getting Started

```bash
npm install
npm start
```
EOF

cd ..

echo ""
echo "✅ Test project created!"
echo ""
echo "Now you can run the bot:"
echo ""
echo "# Basic usage (planning mode)"
echo "node commit-bot.js $(pwd)/example-source $(pwd)/example-target 3 2"
echo ""
echo "# With environment variables"
echo "SOURCE_DIR=$(pwd)/example-source \\"
echo "TARGET_REPO_DIR=$(pwd)/example-target \\"
echo "TOTAL_DAYS=3 \\"
echo "COMMITS_PER_DAY=2 \\"
echo "COMMIT_MODE=auto \\"
echo "node commit-bot.js"
echo ""
echo "# Help/usage"
echo "node commit-bot.js --help"
echo ""
