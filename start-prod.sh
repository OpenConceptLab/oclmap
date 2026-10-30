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
if [[ ! -z "${OIDC_SERVER_URL}" ]]; then
    echo "var OIDC_SERVER_URL = \"${OIDC_SERVER_URL}\";" >> ${ENV_FILE}
fi
if [[ ! -z "${OIDC_REALM}" ]]; then
    echo "var OIDC_REALM = \"${OIDC_REALM}\";" >> ${ENV_FILE}
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
if [[ ! -z "${TERMBROWSER_URL}" ]]; then
    echo "var TERMBROWSER_URL = \"${TERMBROWSER_URL}\";" >> ${ENV_FILE}
fi
if [[ ! -z "${OCL_ONLINE_API_URL}" ]]; then
    echo "var OCL_ONLINE_API_URL = \"${OCL_ONLINE_API_URL}\";" >> ${ENV_FILE}
fi
if [[ ! -z "${REPO_SUGGESTIONS}" ]]; then
    echo "var REPO_SUGGESTIONS = \"${REPO_SUGGESTIONS}\";" >> ${ENV_FILE}
fi

# $1 as a double-quoted JavaScript string literal. Escapes the characters that
# could end the string (", \ and line breaks), so a value can't add script to
# env-config.js. One character at a time, which behaves the same in every bash.
js_string() {
    local s=$1 out= c i
    for ((i = 0; i < ${#s}; i++)); do
        c=${s:i:1}
        case $c in
            \\) out+='\\' ;;
            \") out+='\"' ;;
            $'\n') out+='\n' ;;
            $'\r') out+='\r' ;;
            *) out+=$c ;;
        esac
    done
    printf '"%s"' "$out"
}

# This deployment's announcement banner, as JSON (README, "Announcement
# banner"). The app parses and checks it; unset, no banner shows.
if [[ ! -z "${ANNOUNCEMENT}" ]]; then
    echo "var ANNOUNCEMENT = $(js_string "${ANNOUNCEMENT}");" >> ${ENV_FILE}
fi

echo "Adjusting nginx configuration"
envsubst '$WEB_PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

echo "Starting up the production server"
# exec, so nginx runs as PID 1 and gets the container stop signal instead of a SIGKILL 30 s later
exec nginx -g "daemon off;"
