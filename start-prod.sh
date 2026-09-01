#!/bin/bash

WEB_PORT=${WEB_PORT:-4002}

echo "Adding env-config.js"
ENV_FILE="/usr/share/nginx/html/env-config.js"

rm -f ${ENV_FILE}
touch ${ENV_FILE}

if [[ ! -z "${API_URL}" ]]; then
    echo "var API_URL = \"${API_URL}\";" >> ${ENV_FILE}
fi
if [[ ! -z "${GA_ACCOUNT_ID}" ]]; then
    echo "var GA_ACCOUNT_ID = \"${GA_ACCOUNT_ID}\";" >> ${ENV_FILE}
fi
if [[ ! -z "${RECAPTCHA_SITE_KEY}" ]]; then
    echo "var RECAPTCHA_SITE_KEY = \"${RECAPTCHA_SITE_KEY}\";" >> ${ENV_FILE}
fi
if [[ ! -z "${ERRBIT_URL}" ]]; then
    echo "var ERRBIT_URL = \"${ERRBIT_URL}\";" >> ${ENV_FILE}
fi
if [[ ! -z "${ERRBIT_KEY}" ]]; then
    echo "var ERRBIT_KEY = \"${ERRBIT_KEY}\";" >> ${ENV_FILE}
fi
if [[ ! -z "${HOTJAR_ID}" ]]; then
    echo "var HOTJAR_ID = \"${HOTJAR_ID}\";" >> ${ENV_FILE}
fi
if [[ ! -z "${LOGIN_REDIRECT_URL}" ]]; then
    echo "var LOGIN_REDIRECT_URL = \"${LOGIN_REDIRECT_URL}\";" >> ${ENV_FILE}
fi
if [[ ! -z "${OIDC_RP_CLIENT_ID}" ]]; then
    echo "var OIDC_RP_CLIENT_ID = \"${OIDC_RP_CLIENT_ID}\";" >> ${ENV_FILE}
fi
if [[ ! -z "${OCL_ONLINE}" ]]; then
    echo "var OCL_ONLINE = \"${OCL_ONLINE}\";" >> ${ENV_FILE}
fi
if [[ ! -z "${BRIDGE_MATCH_URL}" ]]; then
    echo "var BRIDGE_MATCH_URL = \"${BRIDGE_MATCH_URL}\";" >> ${ENV_FILE}
fi
if [[ ! -z "${AI_ASSISTANT_API_URL}" ]]; then
    echo "var AI_ASSISTANT_API_URL = \"${AI_ASSISTANT_API_URL}\";" >> ${ENV_FILE}
fi
if [[ ! -z "${SCISPACY_LOINC_API_URL}" ]]; then
    echo "var SCISPACY_LOINC_API_URL = \"${SCISPACY_LOINC_API_URL}\";" >> ${ENV_FILE}
fi
if [[ ! -z "${OCL_ONLINE_API_URL}" ]]; then
    echo "var OCL_ONLINE_API_URL = \"${OCL_ONLINE_API_URL}\";" >> ${ENV_FILE}
fi

echo "Adjusting nginx configuration"
envsubst '$WEB_PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

echo "Starting up the production server"
nginx -g "daemon off;"
