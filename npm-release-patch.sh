#!/bin/sh
MESSAGE="$1"

confirm() {
    # call with a prompt string or use a default
    read -r -p "${1:-Are you sure? [y/N]} " response
    case "$response" in
        [yY][eE][sS]|[yY]) 
            true
            ;;
        *)
            false
            ;;
    esac
}

execute() {
    if git checkout develop &&
        git fetch origin develop &&
        [ `git rev-list HEAD...origin/develop --count` != 0 ] &&
        git merge origin/develop
    then
        echo 'Updated!'
        npm version patch -m "Release version %s"
    else
        echo 'Not updated.'
    fi
}

confirm && execute
