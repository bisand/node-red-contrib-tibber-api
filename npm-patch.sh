#!/bin/sh
MESSAGE="$1"

#npm version patch -m "Release version %s"

#git fetch --all

if git checkout develop &&
    git fetch origin develop &&
    [ `git rev-list HEAD...origin/develop --count` != 0 ] &&
    git merge origin/develop
then
    echo 'Updated!'
    exit 1
else
    echo 'Not updated.'
fi
