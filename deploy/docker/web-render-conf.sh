#!/bin/sh
# 手動 envsubst,只替換 API_UPSTREAM 這一個變數 —— 故意不放進
# /etc/nginx/templates/,因為官方 nginx image 內建的
# 20-envsubst-on-templates.sh 預設會把「所有」現有環境變數當 $var 展開,
# 這樣會把設定檔裡 nginx 自己的 $host / $uri / $remote_addr 也一起清空。
set -eu
envsubst '${API_UPSTREAM}' < /etc/nginx/default.conf.template > /etc/nginx/conf.d/default.conf
