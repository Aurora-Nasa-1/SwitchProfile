#!/bin/bash

# build.sh for Magisk module
VERSION=$(git describe --tags --abbrev=0)
VERSION_CODE=$(date +%Y%m%d)

ID="switchprofile"
NAME="Switch Profile Module"
AUTHOR="Aurora-Nasa-1"
DESCRIPTION="A Magisk module for switching profiles."
Main() {
    case "${1:-}" in
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "  -a, --auto    Auto mode (no confirmation)"
            echo "  -c, --config  for Github Action"
            echo "  -h, --help    Show help"
            exit 0
            ;;
        -c|--config)
            exit 0
            ;;
    esac
    setting
}
setting() {
    echo "id=$ID" > module.prop
    echo "name=$NAME" >> module.prop
    echo "version=$VERSION" >> module.prop
    echo "versionCode=$VERSION_CODE" >> module.prop
    echo "author=$AUTHOR" >> module.prop
    echo "description=$DESCRIPTION" >> module.prop
}

zip -r SwitchProfile.zip ./* 
Main "$@"