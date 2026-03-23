#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "🚀 Starting automated Zsh environment setup..."

# 1. Install Oh My Zsh silently without sudo
if [ ! -d "$HOME/.oh-my-zsh" ]; then
    echo "📦 Installing Oh My Zsh..."
    CHSH=no RUNZSH=no KEEP_ZSHRC=yes sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
else
    echo "✅ Oh My Zsh already exists, skipping installation."
fi

# 2. Define custom plugin directory
ZSH_CUSTOM="$HOME/.oh-my-zsh/custom"

# 3. Install zsh-autosuggestions
if [ ! -d "$ZSH_CUSTOM/plugins/zsh-autosuggestions" ]; then
    echo "📦 Installing zsh-autosuggestions..."
    git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM}/plugins/zsh-autosuggestions
fi

# 4. Install zsh-history-substring-search (replaces your Mac homebrew dependency)
if [ ! -d "$ZSH_CUSTOM/plugins/zsh-history-substring-search" ]; then
    echo "📦 Installing zsh-history-substring-search..."
    git clone https://github.com/zsh-users/zsh-history-substring-search ${ZSH_CUSTOM}/plugins/zsh-history-substring-search
fi

# 5. Install autojump locally without sudo (installs to ~/.autojump)
if [ ! -d "$HOME/.autojump" ]; then
    echo "📦 Compiling and installing autojump locally..."
    git clone https://github.com/wting/autojump.git /tmp/autojump
    cd /tmp/autojump && ./install.py
    rm -rf /tmp/autojump
    cd ~
fi

# 6. Generate a cross-platform compatible, streamlined .zshrc
echo "📝 Writing .zshrc configuration..."

cat > "$HOME/.zshrc" << 'EOF'
export ZSH="$HOME/.oh-my-zsh"

# Theme setup
ZSH_THEME="ys"

# Plugins list
plugins=(
    git
    autojump
    zsh-autosuggestions
    zsh-history-substring-search
    web-search
    copypath
)

source $ZSH/oh-my-zsh.sh

# Basic environment variables
export EDITOR=nvim
export VISUAL=nvim
export PATH="$HOME/.local/bin:$HOME/bin:$PATH"

# Load locally installed autojump
[[ -s ~/.autojump/etc/profile.d/autojump.sh ]] && source ~/.autojump/etc/profile.d/autojump.sh

# SDKMAN initialization logic
export SDKMAN_DIR="$HOME/.sdkman"
[[ -s "$HOME/.sdkman/bin/sdkman-init.sh" ]] && source "$HOME/.sdkman/bin/sdkman-init.sh"

# NVM initialization logic
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

alias c='code'

# Custom function: cf (with macOS and Linux compatibility checks)
function cf() {
    local copy_content=false
    local usage="Usage: cf [-c] [-h] <path>"

    OPTIND=1
    while getopts "ch" opt; do
        case "$opt" in
            c) copy_content=true ;;
            h) echo "$usage"; return 0 ;;
            *) echo "$usage"; return 1 ;;
        esac
    done
    shift $((OPTIND - 1))

    if [ -z "$1" ]; then echo "$usage"; return 1; fi
    if [ ! -e "$1" ]; then echo "Error: '$1' does not exist."; return 1; fi

    if [ "$copy_content" = true ]; then
        if [ -d "$1" ]; then echo "Error: Cannot copy directory content as text."; return 1; fi

        # Determine the OS and use the corresponding clipboard tool
        if command -v pbcopy &> /dev/null; then
            cat "$1" | pbcopy
            echo "Content copied to Mac clipboard."
        elif command -v xclip &> /dev/null; then
            cat "$1" | xclip -selection clipboard
            echo "Content copied to Linux clipboard."
        else
            echo "Error: Neither pbcopy nor xclip found. Cannot copy to clipboard."
        fi
    else
        # Copy file object/path mode
        if command -v osascript &> /dev/null; then
            osascript -e "tell application \"Finder\" to set the clipboard to (POSIX file \"${1:A}\")"
            echo "File object '$1' copied to Mac clipboard."
        else
            # Linux fallback: copy absolute path
            echo "$(readlink -f "$1")" | xclip -selection clipboard 2>/dev/null || echo "File path: $(readlink -f "$1")"
            echo "File path '$1' processed (Linux fallback)."
        fi
    fi
}

# Custom function: swap
swap() {
    if [[ $# -ne 2 ]]; then
        echo "Usage: swap <file1> <file2>"
        return 1
    fi
    local file1="$1"
    local file2="$2"
    if [[ ! -f "$file1" || ! -f "$file2" ]]; then
        echo "Error: Both arguments must be existing regular files."
        return 1
    fi
    if [[ "$file1" -ef "$file2" ]]; then
        echo "Error: Cannot swap a file with itself."
        return 1
    fi
    local tmp_dir=$(dirname "$file1")
    local tmpfile
    if ! tmpfile=$(mktemp "${tmp_dir}/.swap.XXXXXX"); then
        echo "Error: Failed to create a temporary file."
        return 1
    fi
    mv -f "$file1" "$tmpfile"
    mv -f "$file2" "$file1"
    mv -f "$tmpfile" "$file2"
    echo "✅ Successfully swapped the contents of '$file1' and '$file2'."
}
EOF

echo "🎉 Environment setup is complete!"
echo "👉 Please run: exec zsh (or restart your terminal) to apply the changes and enjoy your new environment!"
