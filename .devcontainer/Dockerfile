# Find the Dockerfile at this URL
# https://github.com/Azure/azure-functions-docker/blob/dev/host/4/bullseye/amd64/python/python39/python39-core-tools.Dockerfile
FROM mcr.microsoft.com/azure-functions/python:4-python3.9-core-tools

# Copy library scripts to execute
COPY library-scripts/*.sh library-scripts/*.env /tmp/library-scripts/

# Install Node.js, Azure Static Web Apps CLI and Azure Functions Core Tools
ARG NODE_VERSION="16"
ARG CORE_TOOLS_VERSION="4"
ARG USERNAME="swa-cli"
ENV NVM_DIR="/usr/local/share/nvm" \
    NVM_SYMLINK_CURRENT=true \
    USER_GID=1000 \
    PATH="${NVM_DIR}/current/bin:${PATH}"

RUN GROUPS=$(id -Gn vscode | sed "s/ /,/g" | sed -r 's/\<'vscode'\>\b,?//g') \
    && useradd --shell /bin/bash --groups ${GROUPS} --create-home $USERNAME \
    && echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME \
    && cp -r /home/vscode/. /home/$USERNAME \
    && chown -R swa-cli:vscode /home/$USERNAME

RUN bash /tmp/library-scripts/node-debian.sh "${NVM_DIR}" "${NODE_VERSION}" "${USERNAME}" \
    && apt-get update && apt-get install -y libgtk2.0-0 libgtk-3-0 libgbm-dev libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 libxtst6 xauth xvfb libsecret-1-0 \
    && if [ $CORE_TOOLS_VERSION != "4" ]; then apt-get remove -y azure-functions-core-tools-4 && apt-get install -y "azure-functions-core-tools-${CORE_TOOLS_VERSION}"; fi \
    && apt-get clean -y && rm -rf /var/lib/apt/lists/*

RUN su swa-cli -c "umask 0002 && npm install --cache /tmp/empty-cache -g npm@latest fuzz-run" \
    && if [ -z "$SWA_CLI_VERSION" ]; then su swa-cli -c "umask 0002 && npm install --cache /tmp/empty-cache -g @azure/static-web-apps-cli@$SWA_CLI_VERSION"; fi

USER swa-cli
WORKDIR /home/swa-cli
CMD ["/bin/bash"]
