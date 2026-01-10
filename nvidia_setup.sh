#!/bin/bash

echo "Starting NVIDIA Container Toolkit Setup for Ubuntu 24.04..."
echo "This script will install NVIDIA Container Toolkit for GPU support in Docker"

# Check if we're running as root or can sudo
if [[ $EUID -eq 0 ]]; then
    SUDO=""
else
    SUDO="sudo"
fi

# Add NVIDIA package repositories
echo "Adding NVIDIA package repositories..."
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
echo "Distribution: $distribution"

# Try Ubuntu 22.04 repository for Ubuntu 24.04 compatibility
echo "Trying Ubuntu 22.04 repository for Ubuntu 24.04 compatibility..."

# Download and add GPG key
echo "Downloading GPG key..."
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor | tee nvidia-container-toolkit-keyring.gpg > /dev/null

$SUDO mv nvidia-container-toolkit-keyring.gpg /usr/share/keyrings/

# Create repository file using Ubuntu 22.04 repo for 24.04 compatibility
echo "Creating repository file..."
echo "deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://nvidia.github.io/libnvidia-container/stable/ubuntu22.04/amd64 /" | \
    $SUDO tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

# Install the NVIDIA Container Toolkit
echo "Installing NVIDIA Container Toolkit..."
$SUDO apt-get update
$SUDO apt-get install -y nvidia-container-toolkit

# Configure Docker to use the NVIDIA runtime
echo "Configuring Docker for NVIDIA runtime..."
$SUDO nvidia-ctk runtime configure --runtime=docker

# Try different ways to restart Docker
echo "Restarting Docker..."
if command -v systemctl >/dev/null 2>&1; then
    $SUDO systemctl restart docker
elif command -v service >/dev/null 2>&1; then
    $SUDO service docker restart
else
    echo "Could not restart Docker service - you may need to restart manually"
fi

echo "NVIDIA setup completed!"
echo "Testing GPU access..."
nvidia-smi

echo ""
echo "Testing Docker GPU access..."
docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi
