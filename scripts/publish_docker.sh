#!/bin/bash
#######################################
# Usage: ./publish_docker.sh
#######################################

# Get latest version tag
SWA_CLI_VERSION=$(git describe --tags --abbrev=0)
SWA_CLI_VERSION=${SWA_CLI_VERSION#v}
DOCKER_REPO=swacli/static-web-apps-cli

echo "Latest SWA CLI version: ${SWA_CLI_VERSION}"

echo "Logging in to Docker Hub..."
docker login -u swacli -p ${DOCKER_HUB_PUBLISH_TOKEN}

# Check if an image already exists for this version
if docker manifest inspect ${DOCKER_REPO}:${SWA_CLI_VERSION} > /dev/null; then
  echo "Image for version $SWA_CLI_VERSION already exists. Skipping..."
else
  echo "Creating new image for version $SWA_CLI_VERSION..."
  git checkout tags/v${SWA_CLI_VERSION}
  docker build --build-arg SWA_CLI_VERSION=${SWA_CLI_VERSION} -t swacli:${SWA_CLI_VERSION} .devcontainer/
  docker tag swacli:${SWA_CLI_VERSION} ${DOCKER_REPO}:${SWA_CLI_VERSION}
  docker tag swacli:${SWA_CLI_VERSION} ${DOCKER_REPO}:latest
  docker push ${DOCKER_REPO}:${SWA_CLI_VERSION}
  docker push ${DOCKER_REPO}:latest
fi
