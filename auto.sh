#!/bin/bash

echo "$1"
SCRIPT_DIR="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

baseFileName=$(basename "${1}" '.mkv')
ogSubFileName="${baseFileName}.ass"
ptbrSubFileName="${baseFileName}.pt-br.ass"

ffmpeg -y -i "${1}" -map 0:s:0 -c:s ass "${ogSubFileName}"
grep 'Dialogue:' "${ogSubFileName}"

node "${SCRIPT_DIR}/index.js" "${ogSubFileName}"
grep 'Dialogue:' "${ptbrSubFileName}"
rm -v "${ogSubFileName}"

# subtitle stream
ffmpeg -y -i "${1}" -i "${ptbrSubFileName}" -map 0 -map 1 -c copy -metadata:s:s:1 language=pt-br "${baseFileName}.pt-br.mkv"

# hardcode
#ffmpeg -y -i "${1}" -vf "subtitles='${ptbrSubFileName}'" -c:v libx264 -crf 23 -c:a aac "${baseFileName}.pt-br.mp4"

echo "${baseFileName}.pt-br.mp4"