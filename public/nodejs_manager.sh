#!/bin/bash

# NodeJS安装工具 20241208 2253
arch=$(uname -m)

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root. Please use \"sudo bash\" instead."
  exit 1
fi

printf "\033c"

echo_cyan() {
  printf '\033[1;36m%b\033[0m\n' "$@"
}
echo_red() {
  printf '\033[1;31m%b\033[0m\n' "$@"
}

echo_green() {
  printf '\033[1;32m%b\033[0m\n' "$@"
}

echo_cyan_n() {
  printf '\033[1;36m%b\033[0m' "$@"
}

echo_yellow() {
  printf '\033[1;33m%b\033[0m\n' "$@"
}

Red_Error() {
  echo '================================================='
  printf '\033[1;31;40m%b\033[0m\n' "$@"
  echo '================================================='
  exit 1
}

get_node_versions() {
  local url="$1"
  wget -qO- "$url" | jq -r '.[].version'
}

Install_Node() {
  local node=$1
  local mirror=$2
  echo_cyan_n "[+] Install Node.JS environment...\n"

  rm -irf "$node_install_path"

  cd /opt || Red_Error "[x] Failed to enter /opt"

  rm -rf "node-$node-linux-$arch.tar.gz"

  # Download from chosen mirror
  wget "${mirror}/-/binary/node/$node/node-$node-linux-$arch.tar.gz" 2>&1 | tee /tmp/wget.log || { Red_Error "[x] Failed to download node release"; cat /tmp/wget.log; }

  tar -zxf "node-$node-linux-$arch.tar.gz" 2>&1 | tee /tmp/tar.log || { Red_Error "[x] Failed to untar node"; cat /tmp/tar.log; }

  rm -rf "node-$node-linux-$arch.tar.gz"

  mv "node-$node-linux-$arch" "$node_install_path"

  if [[ -f "$node_install_path"/bin/node ]] && [[ "$("$node_install_path"/bin/node -v)" == "$node" ]]; then
    echo_green "Success"
  else
    Red_Error "[x] Node installation failed!"
  fi

  # Add Node.js binary path to PATH
  add_to_profile() {
    local profile_file="$1"
    if ! grep -Fxq "export PATH=\"$node_install_path/bin:\$PATH\"" "$profile_file"; then
      echo "export PATH=\"$node_install_path/bin:\$PATH\"" >> "$profile_file"
      echo_yellow "Added Node.js and npm to PATH in $profile_file"
    else
      echo_yellow "Node.js and npm are already in PATH in $profile_file"
    fi
  }

  add_to_profile "/root/.bashrc"
  add_to_profile "/etc/profile"

  echo
  echo_green "=====================================\nNode.JS has been installed successfully! If can't use 'node' or 'npm', please reconnect to shell.\n=====================================\n"
  echo_yellow "=============== Node.JS Version ==============="
  echo_yellow " node: $("$node_install_path"/bin/node -v)"
  echo_yellow " npm: v$(env "$node_install_path"/bin/node "$node_install_path"/bin/npm -v)"
  echo_yellow "=============== Node.JS Version ==============="
  echo

  sleep 3
}

Uninstall_Node() {
  echo_cyan_n "[+] Uninstalling Node.JS environment...\n"

  rm -irf "$node_install_path"

  if [[ ! -d "$node_install_path" ]]; then
    echo_green "Success"
  else
    Red_Error "[x] Node uninstallation failed!"
  fi

  echo
  echo_yellow "Node.JS has been uninstalled."
  echo
}

# Environmental inspection
if [[ "$arch" == x86_64 ]]; then
  arch=x64
elif [[ $arch == aarch64 ]]; then
  arch=arm64
elif [[ $arch == arm ]]; then
  arch=armv7l
elif [[ $arch == ppc64le ]]; then
  arch=ppc64le
elif [[ $arch == s390x ]]; then
  arch=s390x
else
  Red_Error "[x] Sorry, this architecture is not supported yet!"
fi

# Define the variable Node installation directory
read -p "Enter the version of Node.js you want to install (e.g., v18.16.1): " node
node=${node/v/} # Remove 'v' prefix if present
node_install_path="/opt/node-v${node}-linux-${arch}"

echo_cyan "=====================================\nWelcome to use ZGIT Node.js Installer/Unistaller.\nver 202412082256\n=====================================\n"

# Check network connection
echo_cyan "[-] Architecture: $arch"

# Install related software
echo_cyan_n "[+] Installing dependent software (git, tar, wget, jq)... "
if [[ -x "$(command -v yum)" ]]; then
  yum install -y git tar wget jq
elif [[ -x "$(command -v apt-get)" ]]; then
  apt-get install -y git tar wget jq
elif [[ -x "$(command -v pacman)" ]]; then
  pacman -S --noconfirm git tar wget jq
elif [[ -x "$(command -v zypper)" ]]; then
  zypper --non-interactive install git tar wget jq
else
  echo_red "[!] Cannot find your package manager! You may need to install git, tar, wget and jq manually!"
fi

# Determine whether the relevant software is installed successfully
if [[ -x "$(command -v git)" && -x "$(command -v tar)" && -x "$(command -v wget)" && -x "$(command -v jq)" ]]; then
  echo_green "Success"
else
  Red_Error "[x] Failed to find git, tar, wget and jq, please install them manually!"
fi



# Ask user if they want to install or uninstall Node.js
read -p "Do you want to install or uninstall Node.js? (ins/uni): " action
case "$action" in 
  ins)
    if [[ -f "$node_install_path"/bin/node ]]; then
      echo_red "Node.js is already installed at $node_install_path"
      echo_yellow "Version: $("$node_install_path"/bin/node -v)"
      echo_yellow "npm Version: v$(env "$node_install_path"/bin/node "$node_install_path"/bin/npm -v)"
      echo_yellow "\nThis script currently does not support multi NodeJS version management. To install other versions, you need to uninstall the current version first."
      exit 0
    fi
    # Ask user for LTS or all versions
    read -p "Do you want to see LTS versions only? (y/n): " lts_only
    if [[ "$lts_only" == "y" ]]; then
      index_url="https://nodejs.org/dist/index.json"
    else
      index_url="https://nodejs.org/dist/index.json"
    fi

    # Ask user for mirror source
    read -p "Do you want to use the NPM mirror source? (y/n): " use_mirror
    if [[ "$use_mirror" == "y" ]]; then
      mirror_base="https://registry.npmmirror.com"
    else
      mirror_base="https://nodejs.org/dist"
    fi

    # Get Node.js versions
    versions=($(get_node_versions "$index_url"))

    # Display version list and ask user to select one
    PS3="Please choose a Node.js version: "
    select selected_version in "${versions[@]}"; do
      if [[ -n "$selected_version" ]]; then
        break
      else
        echo "Invalid selection, please try again."
      fi
    done

    # Install the selected Node version
    Install_Node "$selected_version" "$mirror_base"
    ;;
  uni)
    # Confirm uninstallation
    read -p "Are you sure you want to uninstall Node.js? (y/n): " confirm_uninstall
    if [[ "$confirm_uninstall" == "y" ]]; then
      Uninstall_Node
    else
      echo "Uninstallation cancelled."
    fi
    ;;
  *)
    echo "Invalid action. Please choose either 'ins(install)' or 'uni(uninstall)'."
    exit 1
    ;;
esac




