#!/bin/sh
set -eu

exec xvfb-run -a /usr/bin/openscad "$@"
