#!/usr/bin/env bash
# Serveur de dev ISOPoz. node n'étant pas dans le PATH système, on le préfixe
# (sinon Turbopack échoue au spawn des workers CSS — cf. contexte projet).
export PATH="$HOME/local/node-v24.18.0-darwin-arm64/bin:$HOME/local/node-v20.18.0-darwin-arm64/bin:$PATH"
cd "$(dirname "$0")"
exec node node_modules/next/dist/bin/next dev -p 3002
