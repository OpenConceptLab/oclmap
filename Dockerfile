# Stage-1 Build and Development Environment
FROM node:22 as build
ARG NODE_ENV=production
ARG NODE_OPTIONS=--max_old_space_size=700
ENV OCL_ONLINE=${OCL_ONLINE}
ENV BRIDGE_MATCH_URL=${BRIDGE_MATCH_URL:-''}
ENV NPM_CONFIG_LOGLEVEL warn
ENV WEB_PORT=${WEB_PORT:-4004}
ENV API_URL=${API_URL:-http://127.0.0.1:8000}
ENV GA_ACCOUNT_ID=${GA_ACCOUNT_ID:-UA-000000-01}
ENV ERRBIT_URL=${ERRBIT_URL}
ENV ERRBIT_KEY=${ERRBIT_KEY}
ENV HOTJAR_ID=${HOTJAR_ID}
ENV LOGIN_REDIRECT_URL=${LOGIN_REDIRECT_URL}
ENV OIDC_RP_CLIENT_ID=${OIDC_RP_CLIENT_ID}
ENV OIDC_SERVER_URL=${OIDC_SERVER_URL}
ENV OIDC_REALM=${OIDC_REALM}
ENV OCL_ONLINE_API_URL=${OCL_ONLINE_API_URL}
ENV SCISPACY_LOINC_API_URL=${SCISPACY_LOINC_API_URL}
ENV REPO_SUGGESTIONS=${REPO_SUGGESTIONS}
RUN mkdir /app
WORKDIR /app
ENV PATH /app/node_modules/.bin:$PATH

ADD package.json /app/
ADD package-lock.json /app/

RUN npm ci --production=false

# OPTIONAL: install a private UI package during image build
# PRIVATE_PACKAGES_GIT is an npm install spec, e.g. a git+ssh URL. The package
# fills webpack.config.js's checkpoints; the build fails if it doesn't land.
# GitHub's SSH host keys are pinned (https://api.github.com/meta).
ARG PRIVATE_PACKAGES_GIT
ARG SOURCE_COMMIT
RUN --mount=type=ssh \
  if [ -n "$PRIVATE_PACKAGES_GIT" ]; then \
    mkdir -p /root/.ssh && \
    echo "github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl" >> /root/.ssh/known_hosts && \
    echo "github.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg=" >> /root/.ssh/known_hosts && \
    echo "Installing private UI packages (oclmap commit $SOURCE_COMMIT)" && \
    npm i $PRIVATE_PACKAGES_GIT --no-save --ignore-scripts --production=false && \
    node -e "const p = require('./node_modules/.package-lock.json').packages['node_modules/@openconceptlab/oclmap-extensions']; if(!p) { console.error('The private UI package did not install as @openconceptlab/oclmap-extensions'); process.exit(1) } console.log('Installed', p.version, p.resolved)"; \
  fi

ADD webpack.config.js /app/
ADD .babelrc /app/
ADD src /app/src/
ADD public /app/public/

ADD start.sh /app/
RUN chmod +x start.sh

ADD set_build_version.sh /app/
ADD release_version.sh /app/
RUN chmod +X set_build_version.sh release_version.sh

ARG SOURCE_COMMIT
RUN ["bash", "-c", "./set_build_version.sh"]

RUN npm run build
RUN cp public/bootstrap.min.css dist/
RUN cp public/favicon.ico dist/
RUN cp public/silent-sso.html dist/
RUN cp public/favicon.svg dist/
RUN cp public/dark-favicon.svg dist/
RUN cp public/light-favicon.svg dist/
RUN cp public/fhir.svg dist/
RUN cp public/openmrs_logo_white.gif dist/
RUN cp public/mapper_landing_placeholder.png dist/
RUN cp public/mapper_sample_lab_tests.csv dist/
RUN cp public/FullLogo-BlackText.png dist/
RUN cp -rf public/fontello dist/

EXPOSE ${WEB_PORT}

CMD ["bash", "-c", "./start.sh"]

# Stage-2 Production Environment
FROM nginx:1.19-alpine

ENV WEB_PORT=${WEB_PORT:-4004}

# Add bash
RUN apk add --no-cache bash

ADD start-prod.sh /
RUN chmod +x start-prod.sh

# Copy the tagged files from the build to the production environmnet of the nginx server
COPY --from=build /app/dist/ /usr/share/nginx/html/

# Copy nginx configuration
ADD nginx /etc/nginx/templates/

# Make port available to the world outside the container
EXPOSE ${WEB_PORT}

# Start the server
CMD ["bash", "-c", "/start-prod.sh"]
