# node-chatgpt-proxy
 
![Docker Pulls](https://img.shields.io/docker/pulls/geyinchi/node-chatgpt-proxy?logo=docker&style=plastic)
![Docker Image Size (latest by date)](https://img.shields.io/docker/image-size/geyinchi/node-chatgpt-proxy?logo=docker)
![GitHub top language](https://img.shields.io/github/languages/top/ikechan8370/node-chatgpt-proxy?logo=github)

A simple reverse proxy for chat.openai.com which can bypass cloudflare protection.

This project has been used by [chatgpt-plugin](https://github.com/ikechan8370/chatgpt-plugin) for months, and huge improvements in performance and stability have been made to it.

Give me a star if this project helps or you are using any service supported by it.

## How to use

### with source code

todo

### with docker

just run `docker run -d -p [PORT]:3000 --name node-chatgpt-proxy --shm-size=1gb geyinchi/node-chatgpt-proxy`

Check log: `docker exec -it node-chatgpt-proxy tail -100f /var/log/node-chatgpt-proxy.log`

Check new version and update: `docker pull geyinchi/node-chatgpt-proxy && docker stop node-chatgpt-proxy && docker rm node-chatgpt-proxy && docker run -d -p [PORT
]:3000 --name node-chatgpt-proxy --shm-size=1gb geyinchi/node-chatgpt-proxy`


# 中文

一个简单的chat.openai.com的反代，基于浏览器绕过Cloudflare防护。

本项目目前用于[chatgpt-plugin](https://github.com/ikechan8370/chatgpt-plugin)插件，经中等规模用户长期使用，稳定性不错。

如果这个项目对你有帮助或者你就在使用基于这个项目的其他开源项目，请给我一个免费的Star，谢谢！

## 如何使用

### 源码部署
TODO

### 使用docker
直接运行 `docker run -d -p [PORT]:3000 --name node-chatgpt-proxy --shm-size=1gb geyinchi/node-chatgpt-proxy`

查看日志: `docker exec -it node-chatgpt-proxy tail -100f /var/log/node-chatgpt-proxy.log`

检查新版本并更新: `docker pull geyinchi/node-chatgpt-proxy && docker stop node-chatgpt-proxy && docker rm node-chatgpt-proxy && docker run -d -p [端口号]:3000 --name node-chatgpt-proxy --shm-size=1gb geyinchi/node-chatgpt-proxy`

可以参考这篇博客：https://ikechan8370.com/archives/da-jian-chatgpt-guan-fang-fan-xiang-dai-li

