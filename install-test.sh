#!/bin/bash
# Installation test script for git-oops

set -e

echo "🧪 Testing git-oops installation..."

# Check Node.js version
echo "📋 Checking Node.js version..."
node_version=$(node --version | cut -d'v' -f2)
required_major=18

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

current_major=$(echo $node_version | cut -d'.' -f1)
if [ "$current_major" -lt "$required_major" ]; then
    echo "❌ Node.js $required_major+ required, found $node_version"
    exit 1
fi

echo "✅ Node.js $node_version (meets requirement >=18.0.0)"

# Build the package
echo "🔨 Building package..."
npm run build

# Test CLI directly
echo "🧪 Testing CLI..."
node dist/cli.js --version
node dist/cli.js --help > /dev/null

# Pack and test installation
echo "📦 Creating package..."
npm pack

# Install globally for testing
echo "🌍 Installing globally for testing..."
npm install -g ./git-oops-*.tgz

# Test global installation
echo "🎯 Testing global installation..."
if command -v git-oops &> /dev/null; then
    echo "✅ git-oops command available globally"
    git-oops --version
else
    echo "❌ git-oops command not found globally"
    exit 1
fi

# Test in a Git repository
echo "🔍 Testing in Git repository..."
temp_dir=$(mktemp -d)
cd "$temp_dir"
git init
git config user.name "Test User"
git config user.email "test@example.com"
echo "test" > test.txt
git add test.txt
git commit -m "Initial commit"

# Test basic commands
git-oops save --help > /dev/null
git-oops fixup --help > /dev/null
git-oops undo --help > /dev/null

echo "✅ Basic commands work in Git repository"

# Cleanup
cd - > /dev/null
rm -rf "$temp_dir"
rm -f git-oops-*.tgz

echo "🎉 All tests passed! git-oops is ready for publication!"
echo ""
echo "Next steps:"
echo "1. npm login"
echo "2. npm publish"
echo "3. Celebrate! 🚀"
