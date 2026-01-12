#!/bin/bash
# LibreOffice environment setup for Heroku

export LD_LIBRARY_PATH="$HOME/.apt/usr/lib/libreoffice/program:$HOME/.apt/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH"
export PATH="$HOME/.apt/usr/bin:$PATH"
